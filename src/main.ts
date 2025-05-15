import path from "path";
import Fastify, { FastifyInstance } from "fastify";
import FastifyStatic from "@fastify/static";
import { createProgramOptions } from "./utils/typescript/compiler_host";
import { Reference } from "@angular/compiler-cli/src/ngtsc/imports";
import { getProjectTsConfigPaths } from "./utils/project_tsconfig_paths";
import ts from "typescript";
import { NgDecorator, getAngularDecorators } from "./utils/ng_decorators";
import { NgtscProgram } from "@angular/compiler-cli";
import { extractMetadataLiteral, getImportSpecifier } from "./tsc.helpers";
import { TemplateTypeChecker } from "@angular/compiler-cli/src/ngtsc/typecheck/api";
import { NgElementType } from "./types/ng-element.enum";
import { select, search } from "@inquirer/prompts";
import { CircularDepResolution } from "./prompt.helpers";
import { createSignal } from "./async.helpers";

import apiRoutes from "./routes/api";
import { Tree } from "@angular-devkit/schematics";
import {
  NamedClassDeclaration,
  findTemplateDependencies,
} from "./angular-tsc.helpers";
import {
  MigrationBlockers,
  findMigrationBlockers,
  toStandalone,
  toStandaloneRoute,
} from "./routes/migrate-single";

export type FsTreeNode = { [pahtSegment: string]: FsTreeNode | ts.SourceFile };

export type ScriptContext = {
  program: NgtscProgram;
  basePath: string;
  schematic: {
    tree: Tree;
  };
  checker: {
    ts: ts.TypeChecker;
    ng: TemplateTypeChecker;
  };
  source: {
    tree: FsTreeNode;
    files: readonly ts.SourceFile[];
  };
  elements: {
    cls: ts.ClassDeclaration;
    type: NgElementType;
    decorator: NgDecorator;
    dependencies(): Reference<NamedClassDeclaration>[];
  }[];
  server: {
    instance: FastifyInstance;
    close(): void;
  };
};

export const context = {
  program: null,
  basePath: null,
  schematic: null,
  checker: null,
  elements: null,
  source: null,
} as any as ScriptContext;

export function selectiveStandalone(_options) {
  return async (tree: Tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");

    for (const tsconfigPath of buildPaths) {
      await analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        createProgram,
      });
    }
    return tree;
  };
}

async function analyseDependencies(data) {
  context.basePath = data.basePath;

  const { host, options, rootNames } = createProgramOptions(
    data.tree,
    data.tsconfigPath,
    data.basePath,
    undefined,
    undefined,
    {
      _enableTemplateTypeChecker: true,
      compileNonExportedClasses: true,
      // Avoid checking libraries to speed up the migration.
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    },
  );

  const program: NgtscProgram = data.createProgram({
    rootNames,
    host,
    options,
  });

  const tsChecker = program.getTsProgram().getTypeChecker();
  const templateTypeChecker = program.compiler.getTemplateTypeChecker();

  const sourceFiles: readonly ts.SourceFile[] = program
    .getTsProgram()
    .getSourceFiles();

  const fileTree: FsTreeNode = makeFileTree(sourceFiles);

  const elements = sourceFiles.flatMap((file) =>
    findNgClasses(file, tsChecker),
  );

  context.program = program;
  context.schematic = { tree: data.tree };
  context.source = { files: sourceFiles, tree: fileTree };
  context.checker = { ts: tsChecker, ng: templateTypeChecker };
  context.elements = elements;

  // GLOBALS end

  const fastify = Fastify();

  fastify.register(FastifyStatic, {
    root: path.join(__dirname, "static"),
    prefix: "/static/",
  });
  fastify.register(apiRoutes, { prefix: "/api" });
  fastify.register(toStandaloneRoute, { prefix: "/api" });

  const serverReadySignal = createSignal<string>();
  fastify.listen({ port: 3000 }, (err, address) => {
    if (err) serverReadySignal.reject(err);
    else serverReadySignal.resolve(address);
  });
  await serverReadySignal.instance.then((address) => {
    const separator = `――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――`;
    const serverReadyMessage = `\x1b[34m🌐\x1b[0m Use Web UI @ ${address}/component-list.html or the CLI below.`;

    const message = [separator, serverReadyMessage, separator].join("\n");

    console.log(message + "\n");
  });

  const abortController = new AbortController();
  context.server = {
    instance: fastify,
    close() {
      fastify.close();
      abortController.abort();
    },
  };

  const makeStandalone = (toMigrate: ts.ClassDeclaration[]) => {
    const printer = ts.createPrinter();
    toStandalone(context.source.files, toMigrate, context, printer);
  };

  let done = false;
  const { signal } = abortController;

  try {
    while (!done) {
      const selectedComponent = await selectComponent({ signal });

      const migrationBlockers = findMigrationBlockers({
        classDeclaration: selectedComponent,
        templateTypeChecker,
      });

      if (!migrationBlockers) {
        makeStandalone([selectedComponent]);
        done = true;
      } else {
        const resolution = await selectBlockersResolution({
          selectedComponent,
          migrationBlockers,
          signal,
        });

        switch (resolution) {
          case CircularDepResolution.BackToSelection:
            continue;
          case CircularDepResolution.MigrateAll:
            makeStandalone([
              selectedComponent,
              ...migrationBlockers.sameModuleDependencies,
            ]);
            done = true;
            break;
        }
      }
    }
  } catch (e) {
    const dismissableErrors = ["AbortPromptError", "ExitPromptError"];
    if (e instanceof Error && dismissableErrors.includes(e.name)) {
      console.log("👋 until next time!");
    } else {
      console.error(e);
    }
  }

  fastify.close();
}

// local helpers

async function selectComponent(data: {
  signal: AbortSignal;
}): Promise<ts.ClassDeclaration> {
  const optionList = context.elements
    .filter((element) => element.type === NgElementType.Component)
    .map((component) => ({
      cls: component.cls,
      owningModule: context.checker.ng.getOwningNgModule(component.cls),
    }))
    .filter((component) => Boolean(component.owningModule))
    .map(({ cls, owningModule }) => ({
      name: `${cls.name!.text} (${owningModule!.name!.text})`,
      value: cls,
    }));

  const component = await search(
    {
      message: "Which component to migrate?",
      source: async (term) =>
        optionList.filter(
          (option) =>
            term && option.name.toLowerCase().startsWith(term?.toLowerCase()),
        ),
    },
    { signal: data.signal },
  );

  return component;
}

async function selectBlockersResolution(data: {
  selectedComponent: ts.ClassDeclaration;
  migrationBlockers: MigrationBlockers;
  signal: AbortSignal;
}) {
  const { selectedComponent, migrationBlockers } = data;
  const { sameModuleConsumers, sameModuleDependencies } = migrationBlockers;

  const componentName = selectedComponent.name!.text;
  const owningModuleName =
    context.checker.ng.getOwningNgModule(selectedComponent)?.name!.text;

  const messageLines = [
    "--------------",
    `${componentName} depends on ${sameModuleDependencies.length} component(s) from ${owningModuleName}.`,
    `${sameModuleConsumers.length} component(s) from ${owningModuleName} depend(s) on ${componentName}.`,
    `Migrating only ${selectedComponent.name!.text} will result in circular dependency.`,
    "--------------",
  ];
  const message = messageLines.join("\n");
  console.log(message);

  const resolution = await select(
    {
      message: "How would you like to proceed?",
      choices: [
        {
          name: "Select different component",
          value: CircularDepResolution.BackToSelection,
        },
        {
          name: "Migrate with dependencies",
          value: CircularDepResolution.MigrateAll,
        },
      ],
    },
    { signal: data.signal },
  );

  return resolution;
}

function makeFileTree(sourceFiles: readonly ts.SourceFile[]) {
  const fileTree = {};

  sourceFiles
    .filter((file) => !file.fileName.includes("node_modules"))
    .forEach((file) => {
      const pathSegments = file.fileName.split("/").filter((_) => _);
      let currentFolder = fileTree;

      pathSegments.forEach((segment) => {
        // if is file
        if (segment.includes(".")) {
          currentFolder[segment] = file;
        }

        // if is folder and not created yet
        if (!currentFolder[segment]) {
          currentFolder[segment] = {};
        }

        currentFolder = currentFolder[segment];
      });
    });

  return fileTree;
}

const ngElements = Object.values(NgElementType) as string[];

/**
 * Finds all modules whose declarations can be migrated.
 **/
function findNgClasses(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker) {
  const modules: {
    cls: ts.ClassDeclaration;
    decorator: NgDecorator;
    type: NgElementType;
    dependencies(): Reference<NamedClassDeclaration>[];
  }[] = [];

  const fileHasNgElements = ngElements.some((element) =>
    getImportSpecifier(sourceFile, "@angular/core", element),
  );

  if (!fileHasNgElements) return modules;

  sourceFile.forEachChild(function walk(node) {
    analyseClass: if (ts.isClassDeclaration(node)) {
      const ngDecorator = getAngularDecorators(
        typeChecker,
        ts.getDecorators(node) || [],
      ).find((current) => ngElements.includes(current.name));

      if (!ngDecorator) break analyseClass;

      const metadata = ngDecorator
        ? extractMetadataLiteral(ngDecorator.node)
        : null;

      if (!metadata) break analyseClass;

      modules.push({
        cls: node,
        decorator: ngDecorator,
        type: ngDecorator.name as NgElementType,
        dependencies() {
          if (!this.__templateDependencies) {
            this.__templateDependencies = findTemplateDependencies(
              this.cls,
              context.checker.ng,
            );
          }
          return this.__templateDependencies;
        },
      });
    }

    node.forEachChild(walk);
  });

  return modules;
}
