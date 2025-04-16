import { createProgramOptions } from "./utils/typescript/compiler_host";
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
import { handleToStandalone } from "./routes/migrate-single";
import { Tree } from "@angular-devkit/schematics";
import { handleComponents } from "./routes/components";

export type FsTreeNode = { [pahtSegment: string]: FsTreeNode | ts.SourceFile };

export type ScriptContext = {
  program: NgtscProgram;
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
  }[];
};

export function dependencyVisualizer(_options) {
  return async (tree: Tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");

    for (const tsconfigPath of buildPaths) {
      analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        createProgram,
      });
    }
    // return tree;
  };
}

function analyseDependencies(data) {
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

  const context: ScriptContext = {
    program,
    schematic: {
      tree: data.tree,
    },
    source: {
      files: sourceFiles,
      tree: fileTree,
    },
    checker: {
      ts: tsChecker,
      ng: ngChecker,
    },
    elements,
  };

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
      handler: handleToStandalone,
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

        if (typeof route.path[idx] === "string") {
          return route.path[idx] === pathnameSegments[idx];
        }

        if (route.path[idx] instanceof RegExp) {
          return pathnameSegments[idx].match(route.path[idx]);
        }
      }
    });

    if (matchingRoute) {
      matchingRoute.handler(url, req, res, server, context);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  server.listen(3000, () => {
    console.log("Server is listening on http://localhost:3000");
  });
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
      });
    }

    node.forEachChild(walk);
  });

  return modules;
}
