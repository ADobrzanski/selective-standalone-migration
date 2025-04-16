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

import apiRoutes from "./routes/api";
import { Tree } from "@angular-devkit/schematics";
import {
  NamedClassDeclaration,
  findTemplateDependencies,
} from "./angular-tsc.helpers";
import { toStandaloneRoute } from "./routes/migrate-single";

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
    shut(): void;
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

export function dependencyVisualizer(_options) {
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
    console.log("im don");
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
  const ngChecker = program.compiler.getTemplateTypeChecker();

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
  context.checker = { ts: tsChecker, ng: ngChecker };
  context.elements = elements;

  // GLOBALS end

  const fastify = Fastify();

  fastify.register(FastifyStatic, {
    root: path.join(__dirname, "static"),
    prefix: "/static/",
  });
  fastify.register(apiRoutes, { prefix: "/api" });
  fastify.register(toStandaloneRoute, { prefix: "/api" });

  fastify.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Listening on ${address}`);
  });

  const createSignal = () => {
    const promiseObj = { resolve() {}, reject() {} };
    const promise = new Promise((resolve, reject) => {
      promiseObj.resolve = () => resolve(undefined);
      promiseObj.reject = () => reject();
    });
    return { ...promiseObj, instance: promise };
  };

  const shutdownSignal = createSignal();
  context.server = {
    instance: fastify,
    shut() {
      shutdownSignal.resolve();
      fastify.close();
      console.log("Server closed.");
    },
  };

  await shutdownSignal.instance;
  console.log("Script finished.");
}

// local helpers

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
