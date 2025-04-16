import { createProgramOptions } from "./utils/typescript/compiler_host";
import { Reference } from "@angular/compiler-cli/src/ngtsc/imports";
import { getProjectTsConfigPaths } from "./utils/project_tsconfig_paths";
import ts from "typescript";
import { NgDecorator, getAngularDecorators } from "./utils/ng_decorators";
import { NgtscProgram } from "@angular/compiler-cli";
import http, { IncomingMessage, ServerResponse } from "http";
import { extractMetadataLiteral, getImportSpecifier } from "./tsc.helpers";
import { isNil } from "./ts.helpers";
import { TemplateTypeChecker } from "@angular/compiler-cli/src/ngtsc/typecheck/api";
import { handleFile } from "./routes/file";
import { handleShutdown } from "./routes/shutdown";
import { handleNodeInFile } from "./routes/file/node";
import { handleGraph } from "./routes/graph";
import { NgElementType } from "./types/ng-element.enum";
import { handleComponent } from "./routes/component";
import { handleModules } from "./routes/modules";
import { handleTests } from "./routes/tests";
import { handleStatic } from "./routes/static";
import { handleToStandaloneNew } from "./routes/migrate-single";

import {
  GET_component,
  GET_component_dependency_list,
  GET_component_dependency,
  GET_component_list,
  GET_component_consumer_list,
} from "./routes/api";
import { Tree } from "@angular-devkit/schematics";
import { handleComponents } from "./routes/components";
import {
  NamedClassDeclaration,
  findTemplateDependencies,
} from "./angular-tsc.helpers";

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
    instance: http.Server;
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

  const anyPattern = /^.*$/;
  const nodeIdPattern = /^[\w-]*$/;

  type Route = {
    path: (string | RegExp)[];
    handler: (
      url: URL,
      req: IncomingMessage,
      res: ServerResponse<IncomingMessage>,
      server: http.Server,
      context: ScriptContext,
    ) => void;
  };

  const routes: Route[] = [
    { path: [""], handler: handleFile },
    { path: ["file", anyPattern], handler: handleFile },
    { path: ["api", "component"], handler: GET_component_list },
    { path: ["api", "component", anyPattern], handler: GET_component },
    {
      path: ["api", "component", anyPattern, "dependency"],
      handler: GET_component_dependency_list,
    },
    {
      path: ["api", "component", anyPattern, "consumer"],
      handler: GET_component_consumer_list,
    },
    {
      path: ["api", "component", anyPattern, "dependency", anyPattern],
      handler: GET_component_dependency,
    },
    {
      path: ["file", anyPattern, "node", nodeIdPattern],
      handler: handleNodeInFile,
    },
    { path: ["modules"], handler: handleModules },
    { path: ["tests"], handler: handleTests },
    { path: ["graph"], handler: handleGraph },
    {
      path: ["component", anyPattern],
      handler: handleComponent,
    },
    {
      path: ["migrate-single", anyPattern],
      handler: handleToStandaloneNew,
    },
    {
      path: ["components"],
      handler: handleComponents,
    },
    { path: ["shutdown", anyPattern], handler: handleShutdown },
    { path: ["static", anyPattern], handler: handleStatic },
  ];

  const server = http.createServer((req, res) => {
    const url = new URL(`http://localhost:3000${req.url}`);
    const pathnameSegments = url.pathname.substring(1).split("/");

    const matchingRoute = routes.find((route) => {
      if (route.path.length !== pathnameSegments.length) return false;

      for (let idx in pathnameSegments) {
        if (isNil(route.path[idx])) return false;

        if (
          typeof route.path[idx] === "string" &&
          route.path[idx] !== pathnameSegments[idx]
        ) {
          return false;
        }

        if (
          route.path[idx] instanceof RegExp &&
          !pathnameSegments[idx].match(route.path[idx])
        ) {
          return false;
        }
      }

      return true;
    });

    if (matchingRoute) {
      matchingRoute.handler(url, req, res, server, context);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  const createSignal = () => {
    const promiseObj = { resolve(x: unknown) {}, reject() {} };
    const promise = new Promise((resolve, reject) => {
      promiseObj.resolve = () => resolve();
      promiseObj.reject = () => reject();
    });
    return { ...promiseObj, instance: promise };
  };

  const shutdownSignal = createSignal();
  context.server = {
    instance: server,
    shut() {
      shutdownSignal.resolve(null);
      console.log("should resolve by now");
    },
  };

  server.listen(3000, () => {
    console.log("Server is listening on http://localhost:3000");
  });

  await shutdownSignal.instance;
  console.log("yeehaa");
  server.close();
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
