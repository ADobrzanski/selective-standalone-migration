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
  justTest: () => justTest,
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
          buildPaths.add((0, (await import_core).normalize)(tsConfig));
        } else {
          testPaths.add((0, (await import_core).normalize)(tsConfig));
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
function createHost(tree) {
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
  const core = await import_core;
  console.log(core.workspaces);
  const host = createHost(tree);
  // console.log(await core.workspaces.readWorkspace("/", host));
  const { workspace } = await core.workspaces.readWorkspace("/", host);
  console.log(workspace);
  return workspace;
}

// src/main.ts
var import_compiler_cli = import("@angular/compiler-cli");
function justTest(_options) {
  return async (tree, _context) => {
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const basePath = process.cwd();
    for (const tsconfigPath of buildPaths) {
      const { host, options, rootNames } = createProgramOptions(
        tree,
        tsconfigPath,
        basePath,
        void 0,
        void 0,
        {
          _enableTemplateTypeChecker: true,
          // Required for the template type checker to work.
          compileNonExportedClasses: true,
          // We want to migrate non-exported classes too.
          // Avoid checking libraries to speed up the migration.
          skipLibCheck: true,
          skipDefaultLibCheck: true,
        },
      );
      const program = new (await import_compiler_cli).NgtscProgram(
        rootNames,
        options,
        host,
      );
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    justTest,
  });
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
