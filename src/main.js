"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod,
  )
);
var __toCommonJS = (mod) =>
  __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  dependencyVisualizer: () => dependencyVisualizer,
});
module.exports = __toCommonJS(main_exports);

// src/utils/typescript/compiler_host.ts
var import_path = require("path");
var import_typescript2 = __toESM(require("typescript"));

// src/utils/typescript/parse_tsconfig.ts
var path = __toESM(require("path"));
var import_typescript = __toESM(require("typescript"));
function parseTsconfigFile(tsconfigPath, basePath) {
  const { config } = import_typescript.default.readConfigFile(
    tsconfigPath,
    import_typescript.default.sys.readFile,
  );
  const parseConfigHost = {
    useCaseSensitiveFileNames:
      import_typescript.default.sys.useCaseSensitiveFileNames,
    fileExists: import_typescript.default.sys.fileExists,
    readDirectory: import_typescript.default.sys.readDirectory,
    readFile: import_typescript.default.sys.readFile,
  };
  if (!path.isAbsolute(basePath)) {
    throw Error("Unexpected relative base path has been specified.");
  }
  return import_typescript.default.parseJsonConfigFileContent(
    config,
    parseConfigHost,
    basePath,
    {},
  );
}

// src/utils/typescript/compiler_host.ts
function createProgramOptions(
  tree,
  tsconfigPath,
  basePath,
  fakeFileRead,
  additionalFiles,
  optionOverrides,
) {
  tsconfigPath = (0, import_path.resolve)(basePath, tsconfigPath);
  const parsed = parseTsconfigFile(
    tsconfigPath,
    (0, import_path.dirname)(tsconfigPath),
  );
  const options = optionOverrides
    ? { ...parsed.options, ...optionOverrides }
    : parsed.options;
  const host = createMigrationCompilerHost(
    tree,
    options,
    basePath,
    fakeFileRead,
  );
  return {
    rootNames: parsed.fileNames.concat(additionalFiles || []),
    options,
    host,
  };
}
function createMigrationCompilerHost(tree, options, basePath, fakeRead) {
  const host = import_typescript2.default.createCompilerHost(options, true);
  const defaultReadFile = host.readFile;
  host.readFile = (fileName) => {
    const treeRelativePath = (0, import_path.relative)(basePath, fileName);
    let result = fakeRead?.(treeRelativePath);
    if (typeof result !== "string") {
      result = treeRelativePath.startsWith("..")
        ? defaultReadFile.call(host, fileName)
        : tree.read(treeRelativePath)?.toString();
    }
    return typeof result === "string" ? result.replace(/^\uFEFF/, "") : void 0;
  };
  return host;
}

// src/utils/project_tsconfig_paths.ts
var import_core = import("@angular-devkit/core");
async function getProjectTsConfigPaths(tree) {
  const core = await import_core;
  const buildPaths = /* @__PURE__ */ new Set();
  const testPaths = /* @__PURE__ */ new Set();
  const workspace = await getWorkspace(tree);
  for (const [, project] of workspace.projects) {
    for (const [name, target] of project.targets) {
      if (name !== "build" && name !== "test") {
        continue;
      }
      for (const [, options] of allTargetOptions(target)) {
        const tsConfig = options["tsConfig"];
        if (typeof tsConfig !== "string" || !tree.exists(tsConfig)) {
          continue;
        }
        if (name === "build") {
          buildPaths.add((0, core.normalize)(tsConfig));
        } else {
          testPaths.add((0, core.normalize)(tsConfig));
        }
      }
    }
  }
  return {
    buildPaths: [...buildPaths],
    testPaths: [...testPaths],
  };
}
function* allTargetOptions(target) {
  if (target.options) {
    yield [void 0, target.options];
  }
  if (!target.configurations) {
    return;
  }
  for (const [name, options] of Object.entries(target.configurations)) {
    if (options) {
      yield [name, options];
    }
  }
}
async function createHost(tree) {
  return {
    async readFile(path2) {
      const data = tree.read(path2);
      if (!data) {
        throw new Error("File not found.");
      }
      return (await import_core).virtualFs.fileBufferToString(data);
    },
    async writeFile(path2, data) {
      return tree.overwrite(path2, data);
    },
    async isDirectory(path2) {
      return !tree.exists(path2) && tree.getDir(path2).subfiles.length > 0;
    },
    async isFile(path2) {
      return tree.exists(path2);
    },
  };
}
async function getWorkspace(tree) {
  const host = await createHost(tree);
  const { workspace } = await (
    await import_core
  ).workspaces.readWorkspace("/", host);
  return workspace;
}

// src/main.ts
var import_typescript6 = __toESM(require("typescript"));

// utils/typescript/imports.ts
var import_typescript3 = __toESM(require("typescript"));
function getImportSpecifier(sourceFile, moduleName, specifierName) {
  return (
    getImportSpecifiers(sourceFile, moduleName, [specifierName])[0] ?? null
  );
}
function getImportSpecifiers(sourceFile, moduleName, specifierNames) {
  const matches = [];
  for (const node of sourceFile.statements) {
    if (
      import_typescript3.default.isImportDeclaration(node) &&
      import_typescript3.default.isStringLiteral(node.moduleSpecifier)
    ) {
      const isMatch =
        typeof moduleName === "string"
          ? node.moduleSpecifier.text === moduleName
          : moduleName.test(node.moduleSpecifier.text);
      const namedBindings = node.importClause?.namedBindings;
      if (
        isMatch &&
        namedBindings &&
        import_typescript3.default.isNamedImports(namedBindings)
      ) {
        for (const specifierName of specifierNames) {
          const match = findImportSpecifier(
            namedBindings.elements,
            specifierName,
          );
          if (match) {
            matches.push(match);
          }
        }
      }
    }
  }
  return matches;
}
function findImportSpecifier(nodes, specifierName) {
  return nodes.find((element) => {
    const { name, propertyName } = element;
    return propertyName
      ? propertyName.text === specifierName
      : name.text === specifierName;
  });
}

// src/utils/typescript/decorators.ts
var import_typescript5 = __toESM(require("typescript"));

// src/utils/typescript/imports.ts
var import_typescript4 = __toESM(require("typescript"));
function getImportOfIdentifier(typeChecker, node) {
  const symbol = typeChecker.getSymbolAtLocation(node);
  if (
    !symbol ||
    symbol.declarations === void 0 ||
    !symbol.declarations.length
  ) {
    return null;
  }
  const decl = symbol.declarations[0];
  if (!import_typescript4.default.isImportSpecifier(decl)) {
    return null;
  }
  const importDecl = decl.parent.parent.parent;
  if (!import_typescript4.default.isStringLiteral(importDecl.moduleSpecifier)) {
    return null;
  }
  return {
    // Handles aliased imports: e.g. "import {Component as myComp} from ...";
    name: decl.propertyName ? decl.propertyName.text : decl.name.text,
    importModule: importDecl.moduleSpecifier.text,
    node: importDecl,
  };
}

// src/utils/typescript/decorators.ts
function getCallDecoratorImport(typeChecker, decorator) {
  if (
    !import_typescript5.default.isCallExpression(decorator.expression) ||
    !import_typescript5.default.isIdentifier(decorator.expression.expression)
  ) {
    return null;
  }
  const identifier = decorator.expression.expression;
  return getImportOfIdentifier(typeChecker, identifier);
}

// src/utils/ng_decorators.ts
function getAngularDecorators(typeChecker, decorators) {
  return decorators
    .map((node) => ({
      node,
      importData: getCallDecoratorImport(typeChecker, node),
    }))
    .filter(
      ({ importData }) =>
        importData && importData.importModule.startsWith("@angular/"),
    )
    .map(({ node, importData }) => ({
      node,
      name: importData.name,
      moduleName: importData.importModule,
      importNode: importData.node,
    }));
}

// src/main.ts
var import_compiler_cli = import("@angular/compiler-cli");
function dependencyVisualizer(_options) {
  return async (tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    for (const tsconfigPath of buildPaths) {
      await analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        // createProgram,
      });
    }
  };
}
async function analyseDependencies(data) {
  const { host, options, rootNames } = createProgramOptions(
    data.tree,
    data.tsconfigPath,
    data.basePath,
    void 0,
    void 0,
    {
      _enableTemplateTypeChecker: true,
      compileNonExportedClasses: true,
      // Avoid checking libraries to speed up the migration.
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    },
  );
  const program = (0, (await import_compiler_cli).createProgram)({
    rootNames,
    host,
    options,
  });
  const typeChecker = program.getTsProgram().getTypeChecker();
  const sourceFiles = program.getTsProgram().getSourceFiles();
  for (const sourceFile of sourceFiles) {
    console.log(findNgModuleClasses(sourceFile, typeChecker));
  }
  const templateTypeChecker = program.compiler.getTemplateTypeChecker();
  const modulesToMigrate = /* @__PURE__ */ new Set();
  const declarations = /* @__PURE__ */ new Set();
  console.log(`We did it! ${!!program}`);
}
function findNgModuleClasses(sourceFile, typeChecker) {
  const modules = [];
  const fileImportsNgModule = getImportSpecifier(
    sourceFile,
    "@angular/core",
    "NgModule",
  );
  if (fileImportsNgModule) {
    sourceFile.forEachChild(function walk(node) {
      if (import_typescript6.default.isClassDeclaration(node)) {
        const ngModuleDecorator = getAngularDecorators(
          typeChecker,
          import_typescript6.default.getDecorators(node) || [],
        ).find((current) => current.name === "NgModule");
        const metadata = ngModuleDecorator
          ? extractMetadataLiteral(ngModuleDecorator.node)
          : null;
        if (metadata) {
          const declarations = findLiteralProperty(metadata, "declarations");
          if (
            declarations != null &&
            hasNgModuleMetadataElements(declarations)
          ) {
            modules.push(node);
          }
        }
      }
      node.forEachChild(walk);
    });
  }
  return modules;
}
function extractMetadataLiteral(decorator) {
  return import_typescript6.default.isCallExpression(decorator.expression) &&
    decorator.expression.arguments.length === 1 &&
    import_typescript6.default.isObjectLiteralExpression(
      decorator.expression.arguments[0],
    )
    ? decorator.expression.arguments[0]
    : null;
}
function findLiteralProperty(literal, name) {
  return literal.properties.find(
    (prop) =>
      prop.name &&
      import_typescript6.default.isIdentifier(prop.name) &&
      prop.name.text === name,
  );
}
function hasNgModuleMetadataElements(node) {
  return (
    import_typescript6.default.isPropertyAssignment(node) &&
    (!import_typescript6.default.isArrayLiteralExpression(node.initializer) ||
      node.initializer.elements.length > 0)
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    dependencyVisualizer,
  });
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
