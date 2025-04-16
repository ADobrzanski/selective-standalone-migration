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
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/migrate-single.ts
var migrate_single_exports = {};
__export(migrate_single_exports, {
  dependencyVisualizer: () => dependencyVisualizer
});
module.exports = __toCommonJS(migrate_single_exports);

// src/utils/typescript/compiler_host.ts
var import_typescript2 = __toESM(require("typescript"));

// src/utils/typescript/parse_tsconfig.ts
var import_typescript = __toESM(require("typescript"));

// src/utils/project_tsconfig_paths.ts
async function getProjectTsConfigPaths(tree) {
  const core = await import("@angular-devkit/core");
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
          buildPaths.add(core.normalize(tsConfig));
        } else {
          testPaths.add(core.normalize(tsConfig));
        }
      }
    }
  }
  return {
    buildPaths: [...buildPaths],
    testPaths: [...testPaths]
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
    async readFile(path) {
      const data = tree.read(path);
      if (!data) {
        throw new Error("File not found.");
      }
      const core = await import("@angular-devkit/core");
      return core.virtualFs.fileBufferToString(data);
    },
    async writeFile(path, data) {
      return tree.overwrite(path, data);
    },
    async isDirectory(path) {
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path) {
      return tree.exists(path);
    }
  };
}
async function getWorkspace(tree) {
  const core = await import("@angular-devkit/core");
  const host = createHost(tree);
  const { workspace } = await core.workspaces.readWorkspace("/", host);
  return workspace;
}

// src/angular-tsc.helpers.ts
var import_typescript6 = __toESM(require("typescript"));

// src/types/ng-element.enum.ts
var NgElementType = /* @__PURE__ */ ((NgElementType2) => {
  NgElementType2["Directive"] = "Directive";
  NgElementType2["Component"] = "Component";
  NgElementType2["NgModule"] = "NgModule";
  NgElementType2["Pipe"] = "Pipe";
  return NgElementType2;
})(NgElementType || {});

// src/tsc.helpers.ts
var import_typescript3 = __toESM(require("typescript"));

// utils/typescript/decorators.ts
var import_typescript5 = __toESM(require("typescript"));

// utils/typescript/imports.ts
var import_typescript4 = __toESM(require("typescript"));

// src/angular-tsc.helpers.ts
var knownNgElementTypes = Object.values(NgElementType);

// src/migrate-single.ts
function dependencyVisualizer(_options) {
  console.log("options", _options);
  return async (tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");
    for (const tsconfigPath of buildPaths) {
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  dependencyVisualizer
});
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
