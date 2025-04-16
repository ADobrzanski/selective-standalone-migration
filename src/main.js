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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  context: () => context,
  dependencyVisualizer: () => dependencyVisualizer
});
module.exports = __toCommonJS(main_exports);
var import_path4 = __toESM(require("path"));
var import_fastify = __toESM(require("fastify"));
var import_static = __toESM(require("@fastify/static"));

// src/utils/typescript/compiler_host.ts
var import_path = require("path");
var import_typescript2 = __toESM(require("typescript"));

// src/utils/typescript/parse_tsconfig.ts
var path = __toESM(require("path"));
var import_typescript = __toESM(require("typescript"));
function parseTsconfigFile(tsconfigPath, basePath) {
  const { config } = import_typescript.default.readConfigFile(tsconfigPath, import_typescript.default.sys.readFile);
  const parseConfigHost = {
    useCaseSensitiveFileNames: import_typescript.default.sys.useCaseSensitiveFileNames,
    fileExists: import_typescript.default.sys.fileExists,
    readDirectory: import_typescript.default.sys.readDirectory,
    readFile: import_typescript.default.sys.readFile
  };
  if (!path.isAbsolute(basePath)) {
    throw Error("Unexpected relative base path has been specified.");
  }
  return import_typescript.default.parseJsonConfigFileContent(config, parseConfigHost, basePath, {});
}

// src/utils/typescript/compiler_host.ts
function createProgramOptions(tree, tsconfigPath, basePath, fakeFileRead, additionalFiles, optionOverrides) {
  tsconfigPath = (0, import_path.resolve)(basePath, tsconfigPath);
  const parsed = parseTsconfigFile(tsconfigPath, (0, import_path.dirname)(tsconfigPath));
  const options = optionOverrides ? { ...parsed.options, ...optionOverrides } : parsed.options;
  const host = createMigrationCompilerHost(
    tree,
    options,
    basePath,
    fakeFileRead
  );
  return {
    rootNames: parsed.fileNames.concat(additionalFiles || []),
    options,
    host
  };
}
function createMigrationCompilerHost(tree, options, basePath, fakeRead) {
  const host = import_typescript2.default.createCompilerHost(options, true);
  const defaultReadFile = host.readFile;
  host.readFile = (fileName) => {
    const treeRelativePath = (0, import_path.relative)(basePath, fileName);
    let result = fakeRead?.(treeRelativePath);
    if (typeof result !== "string") {
      result = treeRelativePath.startsWith("..") ? defaultReadFile.call(host, fileName) : tree.read(treeRelativePath)?.toString();
    }
    return typeof result === "string" ? result.replace(/^\uFEFF/, "") : void 0;
  };
  return host;
}

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
    async readFile(path3) {
      const data = tree.read(path3);
      if (!data) {
        throw new Error("File not found.");
      }
      const core = await import("@angular-devkit/core");
      return core.virtualFs.fileBufferToString(data);
    },
    async writeFile(path3, data) {
      return tree.overwrite(path3, data);
    },
    async isDirectory(path3) {
      return !tree.exists(path3) && tree.getDir(path3).subfiles.length > 0;
    },
    async isFile(path3) {
      return tree.exists(path3);
    }
  };
}
async function getWorkspace(tree) {
  const core = await import("@angular-devkit/core");
  const host = createHost(tree);
  const { workspace } = await core.workspaces.readWorkspace("/", host);
  return workspace;
}

// src/main.ts
var import_typescript14 = __toESM(require("typescript"));

// src/utils/typescript/decorators.ts
var import_typescript4 = __toESM(require("typescript"));

// src/utils/typescript/imports.ts
var import_typescript3 = __toESM(require("typescript"));
function getImportOfIdentifier(typeChecker, node) {
  const symbol = typeChecker.getSymbolAtLocation(node);
  if (!symbol || symbol.declarations === void 0 || !symbol.declarations.length) {
    return null;
  }
  const decl = symbol.declarations[0];
  if (!import_typescript3.default.isImportSpecifier(decl)) {
    return null;
  }
  const importDecl = decl.parent.parent.parent;
  if (!import_typescript3.default.isStringLiteral(importDecl.moduleSpecifier)) {
    return null;
  }
  return {
    // Handles aliased imports: e.g. "import {Component as myComp} from ...";
    name: decl.propertyName ? decl.propertyName.text : decl.name.text,
    importModule: importDecl.moduleSpecifier.text,
    node: importDecl
  };
}

// src/utils/typescript/decorators.ts
function getCallDecoratorImport(typeChecker, decorator) {
  if (!import_typescript4.default.isCallExpression(decorator.expression) || !import_typescript4.default.isIdentifier(decorator.expression.expression)) {
    return null;
  }
  const identifier = decorator.expression.expression;
  return getImportOfIdentifier(typeChecker, identifier);
}

// src/utils/ng_decorators.ts
function getAngularDecorators(typeChecker, decorators) {
  return decorators.map((node) => ({
    node,
    importData: getCallDecoratorImport(typeChecker, node)
  })).filter(
    ({ importData }) => importData && importData.importModule.startsWith("@angular/")
  ).map(({ node, importData }) => ({
    node,
    name: importData.name,
    moduleName: importData.importModule,
    importNode: importData.node
  }));
}

// src/tsc.helpers.ts
var import_typescript5 = __toESM(require("typescript"));
function getImportSpecifier(sourceFile, moduleName, specifierName) {
  return getImportSpecifiers(sourceFile, moduleName, [specifierName])[0] ?? null;
}
function getImportSpecifiers(sourceFile, moduleName, specifierNames) {
  const matches = [];
  for (const node of sourceFile.statements) {
    if (import_typescript5.default.isImportDeclaration(node) && import_typescript5.default.isStringLiteral(node.moduleSpecifier)) {
      const isMatch = typeof moduleName === "string" ? node.moduleSpecifier.text === moduleName : moduleName.test(node.moduleSpecifier.text);
      const namedBindings = node.importClause?.namedBindings;
      if (isMatch && namedBindings && import_typescript5.default.isNamedImports(namedBindings)) {
        for (const specifierName of specifierNames) {
          const match = findImportSpecifier(
            namedBindings.elements,
            specifierName
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
    return propertyName ? propertyName.text === specifierName : name.text === specifierName;
  });
}
function extractMetadataLiteral(decorator) {
  return import_typescript5.default.isCallExpression(decorator.expression) && decorator.expression.arguments.length === 1 && import_typescript5.default.isObjectLiteralExpression(decorator.expression.arguments[0]) ? decorator.expression.arguments[0] : null;
}

// src/types/ng-element.enum.ts
var NgElementType = /* @__PURE__ */ ((NgElementType2) => {
  NgElementType2["Directive"] = "Directive";
  NgElementType2["Component"] = "Component";
  NgElementType2["NgModule"] = "NgModule";
  NgElementType2["Pipe"] = "Pipe";
  return NgElementType2;
})(NgElementType || {});

// src/routes/api-responses.ts
var noElementWithId = (id) => ({
  details: `No element with ID equal ${id}.`
});
var notOfType = (opts) => ({
  details: `Element with ID equal ${opts.id} is not ${opts.type}.`
});

// src/routes/api.ts
var getPipe = (cls) => {
  const meta = getPipeMetadata(cls);
  if (!meta) throw Error(`Element of is not a directive`);
  const owningModule = getOwningNgModule(cls);
  return {
    id: context.elements.findIndex((el) => el.cls === cls),
    type: "Pipe" /* Pipe */,
    name: meta.name,
    className: cls.name?.escapedText,
    standalone: meta.isStandalone,
    declaredIn: owningModule && getModule(owningModule)
  };
};
var getDirectiveMetadata = (cls) => context.checker.ng.getDirectiveMetadata(cls);
var getPipeMetadata = (cls) => context.checker.ng.getPipeMetadata(cls);
var getOwningNgModule = (cls) => context.checker.ng.getOwningNgModule(cls);
var getDirective = (cls) => {
  const meta = getDirectiveMetadata(cls);
  if (!meta) throw Error(`Element of is not a directive`);
  const owningModule = getOwningNgModule(cls);
  const declaredIn = owningModule && context.elements.find((element) => element.cls === owningModule);
  const directive = {
    id: context.elements.findIndex((el) => el.cls === cls),
    name: cls.name?.escapedText,
    type: meta.isComponent ? "Component" /* Component */ : "Directive" /* Directive */,
    selector: meta?.selector,
    standalone: meta?.isStandalone,
    declaredIn: declaredIn?.cls && getModule(declaredIn.cls)
  };
  return directive;
};
var getComponent = (cls) => {
  const directive = getDirective(cls);
  if (directive.type !== "Component" /* Component */)
    throw Error(`Element of is not a component`);
  return directive;
};
var getModule = (cls) => {
  const meta = context.checker.ng.getNgModuleMetadata(cls);
  if (!meta) throw Error(`Element "${cls.name?.escapedText}" is not a module.`);
  const module2 = {
    id: context.elements.findIndex((el) => el.cls === cls),
    name: cls.name?.escapedText,
    type: "NgModule" /* NgModule */
  };
  return module2;
};
var apiRoutes = async (fastify, _options) => {
  fastify.get("/module", async (_request, _reply) => {
    const moduleList = context.elements.map((element, id) => ({ ...element, id })).filter((element) => element.type === "NgModule" /* NgModule */).map((component) => getModule(component.cls));
    return moduleList;
  });
  fastify.get("/component", async (_request, _reply) => {
    const componentList = context.elements.map((element, id) => ({ ...element, id })).filter((element) => element.type === "Component" /* Component */).map((component) => getComponent(component.cls));
    return componentList;
  });
  fastify.get("/component/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const element = context.elements.at(id);
    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }
    if (element.type !== "Component" /* Component */) {
      reply.status(404).send(notOfType({ id, type: "Component" /* Component */ }));
      return;
    }
    return getComponent(element.cls);
  });
  fastify.get("/component/:id/dependency", async (request, reply) => {
    const id = Number(request.params.id);
    const element = context.elements.at(id);
    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }
    if (element.type !== "Component" /* Component */) {
      reply.status(404).send(notOfType({ id, type: "Component" /* Component */ }));
      return;
    }
    const dependencies = element.dependencies().map((dep) => {
      const depCls = dep.node;
      try {
        return getDirective(depCls);
      } catch (e) {
      }
      try {
        return getPipe(depCls);
      } catch (e) {
      }
      return null;
    }).filter(Boolean);
    return dependencies;
  });
  fastify.get(
    "/component/:id/dependency/:dependencyId",
    async (request, reply) => {
      const params = request.params;
      const componentId = Number(params.id);
      const depId = Number(params.dependencyId);
      const component = context.elements.at(componentId);
      const dep = context.elements.at(depId);
      if (!component) {
        reply.status(404).send(noElementWithId(componentId));
        return;
      }
      if (component.type !== "Component" /* Component */) {
        reply.status(400).send(notOfType({ id: componentId, type: "Component" /* Component */ }));
        return;
      }
      if (!dep) {
        reply.status(404).send(noElementWithId(depId));
        return;
      }
      const templateDependencyTypes = [
        "Component" /* Component */,
        "Directive" /* Directive */,
        "Pipe" /* Pipe */
      ];
      if (!templateDependencyTypes.includes(dep.type)) {
        reply.status(400).send(
          notOfType({ id: depId, type: templateDependencyTypes.join(", ") })
        );
        return;
      }
      if (dep.type === "Component" /* Component */ || dep.type === "Directive" /* Directive */) {
        return getDirective(dep.cls);
      } else {
        return getPipe(dep.cls);
      }
    }
  );
  fastify.get("/component/:id/consumer", async (request, reply) => {
    const id = Number(request.params.id);
    const element = context.elements.at(id);
    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }
    if (element.type !== "Component" /* Component */) {
      reply.status(404).send(notOfType({ id, type: "Component" /* Component */ }));
      return;
    }
    const directConsumers = context.elements.filter((el) => el.type === "Component" /* Component */).filter((cp, index, array) => {
      console.log(
        `(${index}/${array.length}) analysing ${cp.cls.name?.escapedText}`
      );
      const dependencies = cp.dependencies();
      const hit = dependencies.map((dep) => dep.node).includes(element.cls);
      if (hit)
        console.log(
          `(${index}/${array.length}) ${cp.cls.name?.escapedText} is a HIT!`
        );
      return hit;
    });
    return directConsumers.map((consumer) => {
      switch (consumer.type) {
        case "Pipe" /* Pipe */:
          return getPipe(consumer.cls);
        case "Component" /* Component */:
          return getComponent(consumer.cls);
        case "Directive" /* Directive */:
          return getDirective(consumer.cls);
        case "NgModule" /* NgModule */:
          return getModule(consumer.cls);
      }
    });
  });
  fastify.get("/directive", async (_request, _reply) => {
    const directiveList = context.elements.map((element, id) => ({ ...element, id })).filter((element) => element.type === "Directive" /* Directive */).map((component) => getDirective(component.cls));
    return directiveList;
  });
};
var api_default = apiRoutes;

// src/angular-tsc.helpers.ts
var import_typescript8 = __toESM(require("typescript"));

// utils/typescript/decorators.ts
var import_typescript7 = __toESM(require("typescript"));

// utils/typescript/imports.ts
var import_typescript6 = __toESM(require("typescript"));

// src/angular-tsc.helpers.ts
function findTemplateDependencies(decl, typeChecker) {
  const results = [];
  const usedDirectives = typeChecker.getUsedDirectives(decl);
  const usedPipes = typeChecker.getUsedPipes(decl);
  if (usedDirectives !== null) {
    for (const dir of usedDirectives) {
      if (import_typescript8.default.isClassDeclaration(dir.ref.node)) {
        results.push(dir.ref);
      }
    }
  }
  if (usedPipes !== null) {
    const potentialPipes = typeChecker.getPotentialPipes(decl);
    for (const pipe of potentialPipes) {
      if (import_typescript8.default.isClassDeclaration(pipe.ref.node) && usedPipes.some((current) => pipe.name === current)) {
        results.push(pipe.ref);
      }
    }
  }
  return results;
}
var knownNgElementTypes = Object.values(NgElementType);

// src/routes/migrate-single.ts
var import_typescript13 = __toESM(require("typescript"));
var import_fast_xml_parser = require("fast-xml-parser");

// utils/change_tracker.ts
var import_typescript10 = __toESM(require("typescript"));

// utils/import_manager.ts
var import_path2 = require("path");
var import_typescript9 = __toESM(require("typescript"));
var ImportManager = class {
  constructor(getUpdateRecorder, printer) {
    this.getUpdateRecorder = getUpdateRecorder;
    this.printer = printer;
  }
  /** Map of import declarations that need to be updated to include the given symbols. */
  updatedImports = /* @__PURE__ */ new Map();
  /** Map of source-files and their previously used identifier names. */
  usedIdentifierNames = /* @__PURE__ */ new Map();
  /** Map of source files and the new imports that have to be added to them. */
  newImports = /* @__PURE__ */ new Map();
  /** Map between a file and the implied quote style for imports. */
  quoteStyles = {};
  /**
   * Array of previously resolved symbol imports. Cache can be re-used to return
   * the same identifier without checking the source-file again.
   */
  importCache = [];
  /**
   * Adds an import to the given source-file and returns the TypeScript
   * identifier that can be used to access the newly imported symbol.
   */
  addImportToSourceFile(sourceFile, symbolName, moduleName, alias = null, typeImport = false, keepSymbolName = false) {
    const sourceDir = (0, import_path2.dirname)(sourceFile.fileName);
    let importStartIndex = 0;
    let existingImport = null;
    const cachedImport = this.importCache.find(
      (c) => c.sourceFile === sourceFile && c.symbolName === symbolName && c.moduleName === moduleName && c.alias === alias
    );
    if (cachedImport) {
      return cachedImport.identifier;
    }
    for (let i = sourceFile.statements.length - 1; i >= 0; i--) {
      const statement = sourceFile.statements[i];
      if (!import_typescript9.default.isImportDeclaration(statement) || !import_typescript9.default.isStringLiteral(statement.moduleSpecifier) || !statement.importClause) {
        continue;
      }
      if (importStartIndex === 0) {
        importStartIndex = this._getEndPositionOfNode(statement);
      }
      const moduleSpecifier = statement.moduleSpecifier.text;
      if (moduleSpecifier.startsWith(".") && (0, import_path2.resolve)(sourceDir, moduleSpecifier) !== (0, import_path2.resolve)(sourceDir, moduleName) || moduleSpecifier !== moduleName) {
        continue;
      }
      if (statement.importClause.namedBindings) {
        const namedBindings = statement.importClause.namedBindings;
        if (import_typescript9.default.isNamespaceImport(namedBindings) && !typeImport) {
          return import_typescript9.default.factory.createPropertyAccessExpression(
            import_typescript9.default.factory.createIdentifier(namedBindings.name.text),
            import_typescript9.default.factory.createIdentifier(alias || symbolName || "default")
          );
        } else if (import_typescript9.default.isNamedImports(namedBindings) && symbolName) {
          const existingElement = namedBindings.elements.find((e) => {
            if (alias) {
              return e.propertyName && e.name.text === alias && e.propertyName.text === symbolName;
            }
            return e.propertyName ? e.propertyName.text === symbolName : e.name.text === symbolName;
          });
          if (existingElement) {
            return import_typescript9.default.factory.createIdentifier(existingElement.name.text);
          }
          existingImport = statement;
        }
      } else if (statement.importClause.name && !symbolName) {
        return import_typescript9.default.factory.createIdentifier(statement.importClause.name.text);
      }
    }
    if (existingImport) {
      const { propertyName, name } = this._getImportParts(
        sourceFile,
        symbolName,
        alias,
        keepSymbolName
      );
      this.updatedImports.set(
        existingImport,
        (this.updatedImports.get(existingImport) || []).concat({
          propertyName,
          importName: name
        })
      );
      this.importCache.push({
        sourceFile,
        moduleName,
        symbolName,
        alias,
        identifier: name
      });
      return name;
    }
    let identifier = null;
    if (!this.newImports.has(sourceFile)) {
      this.newImports.set(sourceFile, {
        importStartIndex,
        defaultImports: /* @__PURE__ */ new Map(),
        namedImports: /* @__PURE__ */ new Map()
      });
    }
    if (symbolName) {
      const { propertyName, name } = this._getImportParts(
        sourceFile,
        symbolName,
        alias,
        keepSymbolName
      );
      const importMap = this.newImports.get(sourceFile).namedImports;
      identifier = name;
      if (!importMap.has(moduleName)) {
        importMap.set(moduleName, []);
      }
      importMap.get(moduleName).push(import_typescript9.default.factory.createImportSpecifier(false, propertyName, name));
    } else {
      const importMap = this.newImports.get(sourceFile).defaultImports;
      identifier = this._getUniqueIdentifier(sourceFile, "defaultExport");
      importMap.set(moduleName, identifier);
    }
    this.importCache.push({
      sourceFile,
      symbolName,
      moduleName,
      alias,
      identifier
    });
    return identifier;
  }
  /**
   * Stores the collected import changes within the appropriate update recorders. The
   * updated imports can only be updated *once* per source-file because previous updates
   * could otherwise shift the source-file offsets.
   */
  recordChanges() {
    this.updatedImports.forEach((expressions, importDecl) => {
      const sourceFile = importDecl.getSourceFile();
      const recorder = this.getUpdateRecorder(sourceFile);
      const namedBindings = importDecl.importClause.namedBindings;
      const newNamedBindings = import_typescript9.default.factory.updateNamedImports(
        namedBindings,
        namedBindings.elements.concat(
          expressions.map(
            ({ propertyName, importName }) => import_typescript9.default.factory.createImportSpecifier(false, propertyName, importName)
          )
        )
      );
      const newNamedBindingsText = this.printer.printNode(
        import_typescript9.default.EmitHint.Unspecified,
        newNamedBindings,
        sourceFile
      );
      recorder.updateExistingImport(namedBindings, newNamedBindingsText);
    });
    this.newImports.forEach(
      ({ importStartIndex, defaultImports, namedImports }, sourceFile) => {
        const recorder = this.getUpdateRecorder(sourceFile);
        const useSingleQuotes = this._getQuoteStyle(sourceFile) === 0 /* Single */;
        defaultImports.forEach((identifier, moduleName) => {
          const newImport = import_typescript9.default.factory.createImportDeclaration(
            void 0,
            import_typescript9.default.factory.createImportClause(false, identifier, void 0),
            import_typescript9.default.factory.createStringLiteral(moduleName, useSingleQuotes)
          );
          recorder.addNewImport(
            importStartIndex,
            this._getNewImportText(importStartIndex, newImport, sourceFile)
          );
        });
        namedImports.forEach((specifiers, moduleName) => {
          const newImport = import_typescript9.default.factory.createImportDeclaration(
            void 0,
            import_typescript9.default.factory.createImportClause(
              false,
              void 0,
              import_typescript9.default.factory.createNamedImports(specifiers)
            ),
            import_typescript9.default.factory.createStringLiteral(moduleName, useSingleQuotes)
          );
          recorder.addNewImport(
            importStartIndex,
            this._getNewImportText(importStartIndex, newImport, sourceFile)
          );
        });
      }
    );
  }
  /** Gets an unique identifier with a base name for the given source file. */
  _getUniqueIdentifier(sourceFile, baseName) {
    if (this.isUniqueIdentifierName(sourceFile, baseName)) {
      this._recordUsedIdentifier(sourceFile, baseName);
      return import_typescript9.default.factory.createIdentifier(baseName);
    }
    let name = "";
    let counter = 1;
    do {
      name = `${baseName}_${counter++}`;
    } while (!this.isUniqueIdentifierName(sourceFile, name));
    this._recordUsedIdentifier(sourceFile, name);
    return import_typescript9.default.factory.createIdentifier(name);
  }
  /**
   * Checks whether the specified identifier name is used within the given
   * source file.
   */
  isUniqueIdentifierName(sourceFile, name) {
    if (this.usedIdentifierNames.has(sourceFile) && this.usedIdentifierNames.get(sourceFile).indexOf(name) !== -1) {
      return false;
    }
    const nodeQueue = [sourceFile];
    while (nodeQueue.length) {
      const node = nodeQueue.shift();
      if (import_typescript9.default.isIdentifier(node) && node.text === name && // Identifiers that are aliased in an import aren't
      // problematic since they're used under a different name.
      (!import_typescript9.default.isImportSpecifier(node.parent) || node.parent.propertyName !== node)) {
        return false;
      }
      nodeQueue.push(...node.getChildren());
    }
    return true;
  }
  _recordUsedIdentifier(sourceFile, identifierName) {
    this.usedIdentifierNames.set(
      sourceFile,
      (this.usedIdentifierNames.get(sourceFile) || []).concat(identifierName)
    );
  }
  /**
   * Determines the full end of a given node. By default the end position of a node is
   * before all trailing comments. This could mean that generated imports shift comments.
   */
  _getEndPositionOfNode(node) {
    const nodeEndPos = node.getEnd();
    const commentRanges = import_typescript9.default.getTrailingCommentRanges(
      node.getSourceFile().text,
      nodeEndPos
    );
    if (!commentRanges || !commentRanges.length) {
      return nodeEndPos;
    }
    return commentRanges[commentRanges.length - 1].end;
  }
  /** Gets the text that should be added to the file for a newly-created import declaration. */
  _getNewImportText(importStartIndex, newImport, sourceFile) {
    const text = this.printer.printNode(
      import_typescript9.default.EmitHint.Unspecified,
      newImport,
      sourceFile
    );
    return importStartIndex === 0 ? `${text}
` : `
${text}`;
  }
  /**
   * Gets the different parts necessary to construct an import specifier.
   * @param sourceFile File in which the import is being inserted.
   * @param symbolName Name of the symbol.
   * @param alias Alias that the symbol may be available under.
   * @returns Object containing the different parts. E.g. `{name: 'alias', propertyName: 'name'}`
   * would correspond to `import {name as alias}` while `{name: 'name', propertyName: undefined}`
   * corresponds to `import {name}`.
   */
  _getImportParts(sourceFile, symbolName, alias, keepSymbolName) {
    const symbolIdentifier = import_typescript9.default.factory.createIdentifier(symbolName);
    const aliasIdentifier = alias ? import_typescript9.default.factory.createIdentifier(alias) : null;
    const generatedUniqueIdentifier = this._getUniqueIdentifier(
      sourceFile,
      alias || symbolName
    );
    const needsGeneratedUniqueName = generatedUniqueIdentifier.text !== (alias || symbolName);
    let propertyName;
    let name;
    if (needsGeneratedUniqueName && !keepSymbolName) {
      propertyName = symbolIdentifier;
      name = generatedUniqueIdentifier;
    } else if (aliasIdentifier) {
      propertyName = symbolIdentifier;
      name = aliasIdentifier;
    } else {
      name = symbolIdentifier;
    }
    return { propertyName, name };
  }
  /** Gets the quote style that is used for a file's imports. */
  _getQuoteStyle(sourceFile) {
    if (!this.quoteStyles.hasOwnProperty(sourceFile.fileName)) {
      let quoteStyle;
      for (const statement of sourceFile.statements) {
        if (import_typescript9.default.isImportDeclaration(statement) && import_typescript9.default.isStringLiteralLike(statement.moduleSpecifier)) {
          quoteStyle = statement.moduleSpecifier.getText().trim().startsWith('"') ? 1 /* Double */ : 0 /* Single */;
          break;
        }
      }
      this.quoteStyles[sourceFile.fileName] = quoteStyle ?? 0 /* Single */;
    }
    return this.quoteStyles[sourceFile.fileName];
  }
};

// utils/change_tracker.ts
var ChangeTracker = class {
  constructor(_printer, _importRemapper) {
    this._printer = _printer;
    this._importRemapper = _importRemapper;
    this._importManager = new ImportManager(
      (currentFile) => ({
        addNewImport: (start, text) => this.insertText(currentFile, start, text),
        updateExistingImport: (namedBindings, text) => this.replaceText(
          currentFile,
          namedBindings.getStart(),
          namedBindings.getWidth(),
          text
        )
      }),
      this._printer
    );
  }
  _changes = /* @__PURE__ */ new Map();
  _importManager;
  /**
   * Tracks the insertion of some text.
   * @param sourceFile File in which the text is being inserted.
   * @param start Index at which the text is insert.
   * @param text Text to be inserted.
   */
  insertText(sourceFile, index, text) {
    this._trackChange(sourceFile, { start: index, text });
  }
  /**
   * Replaces text within a file.
   * @param sourceFile File in which to replace the text.
   * @param start Index from which to replace the text.
   * @param removeLength Length of the text being replaced.
   * @param text Text to be inserted instead of the old one.
   */
  replaceText(sourceFile, start, removeLength, text) {
    this._trackChange(sourceFile, { start, removeLength, text });
  }
  /**
   * Replaces the text of an AST node with a new one.
   * @param oldNode Node to be replaced.
   * @param newNode New node to be inserted.
   * @param emitHint Hint when formatting the text of the new node.
   * @param sourceFileWhenPrinting File to use when printing out the new node. This is important
   * when copying nodes from one file to another, because TypeScript might not output literal nodes
   * without it.
   */
  replaceNode(oldNode, newNode, emitHint = import_typescript10.default.EmitHint.Unspecified, sourceFileWhenPrinting) {
    const sourceFile = oldNode.getSourceFile();
    this.replaceText(
      sourceFile,
      oldNode.getStart(),
      oldNode.getWidth(),
      this._printer.printNode(
        emitHint,
        newNode,
        sourceFileWhenPrinting || sourceFile
      )
    );
  }
  /**
   * Removes the text of an AST node from a file.
   * @param node Node whose text should be removed.
   */
  removeNode(node) {
    this._trackChange(node.getSourceFile(), {
      start: node.getStart(),
      removeLength: node.getWidth(),
      text: ""
    });
  }
  /**
   * Adds an import to a file.
   * @param sourceFile File to which to add the import.
   * @param symbolName Symbol being imported.
   * @param moduleName Module from which the symbol is imported.
   * @param alias Alias to use for the import.
   * @param keepSymbolName Whether to keep the symbol name in the import.
   */
  addImport(sourceFile, symbolName, moduleName, alias = null, keepSymbolName = false) {
    if (this._importRemapper) {
      moduleName = this._importRemapper(moduleName, sourceFile.fileName);
    }
    moduleName = normalizePath(moduleName);
    return this._importManager.addImportToSourceFile(
      sourceFile,
      symbolName,
      moduleName,
      alias,
      false,
      keepSymbolName
    );
  }
  /**
   * Gets the changes that should be applied to all the files in the migration.
   * The changes are sorted in the order in which they should be applied.
   */
  recordChanges() {
    this._importManager.recordChanges();
    return this._changes;
  }
  /**
   * Clear the tracked changes
   */
  clearChanges() {
    this._changes.clear();
  }
  /**
   * Adds a change to a `ChangesByFile` map.
   * @param file File that the change is associated with.
   * @param change Change to be added.
   */
  _trackChange(file, change) {
    const changes = this._changes.get(file);
    if (changes) {
      const insertIndex = changes.findIndex(
        (current) => current.start <= change.start
      );
      if (insertIndex === -1) {
        changes.push(change);
      } else {
        changes.splice(insertIndex, 0, change);
      }
    } else {
      this._changes.set(file, [change]);
    }
  }
};
function normalizePath(path3) {
  return path3.replace(/\\/g, "/");
}

// utils/typescript/nodes.ts
var import_typescript11 = __toESM(require("typescript"));

// src/routes/migrate-single.ts
var import_path3 = require("path");
var fs = __toESM(require("fs"));

// src/routes/migrate-single/utils.ts
var import_typescript12 = __toESM(require("typescript"));
function isClassImported(data) {
  const { classDeclaration, sourceFile, typeChecker } = data;
  if (!classDeclaration.name) {
    return false;
  }
  const targetSymbol = typeChecker.getSymbolAtLocation(classDeclaration.name);
  if (!targetSymbol) {
    console.warn(
      `Could not get symbol for class: ${classDeclaration.name.text}`
    );
    return false;
  }
  let isImported = false;
  import_typescript12.default.forEachChild(sourceFile, visitNode);
  function visitNode(node) {
    if (isImported) {
      return true;
    }
    if (import_typescript12.default.isImportDeclaration(node)) {
      const importClause = node.importClause;
      if (importClause) {
        if (importClause.name) {
          const localSymbol = typeChecker.getSymbolAtLocation(
            importClause.name
          );
          if (localSymbol) {
            const aliasedSymbol = typeChecker.getAliasedSymbol(localSymbol);
            if (aliasedSymbol === targetSymbol) {
              isImported = true;
              return true;
            }
          }
        }
        if (importClause.namedBindings && import_typescript12.default.isNamedImports(importClause.namedBindings)) {
          for (const element of importClause.namedBindings.elements) {
            const localSymbol = typeChecker.getSymbolAtLocation(element.name);
            if (localSymbol) {
              const aliasedSymbol = typeChecker.getAliasedSymbol(localSymbol);
              if (aliasedSymbol === targetSymbol) {
                isImported = true;
                return true;
              }
            }
          }
        }
        if (importClause.namedBindings && import_typescript12.default.isNamespaceImport(importClause.namedBindings)) {
          const moduleSpecifier = node.moduleSpecifier;
          const moduleSymbol = typeChecker.getSymbolAtLocation(moduleSpecifier);
          if (moduleSymbol) {
            const moduleExports = typeChecker.getExportsOfModule(moduleSymbol);
            if (moduleExports.some((expSymbol) => expSymbol === targetSymbol)) {
              isImported = true;
              return true;
            }
          }
        }
      }
    }
    if (!isImported) {
      return import_typescript12.default.forEachChild(node, visitNode);
    }
  }
  return isImported;
}

// src/routes/migrate-single.ts
var toStandaloneRoute = async (fastify, _options) => {
  fastify.get("/component/:id/$makeStandalone", async (request, reply) => {
    const id = Number(request.params.id);
    const component = context.elements.at(id);
    if (!component) {
      reply.status(404).send(noElementWithId(id));
      return;
    }
    if (component.type !== "Component" /* Component */) {
      reply.status(404).send(notOfType({ id, type: "Component" /* Component */ }));
      return;
    }
    const printer = import_typescript13.default.createPrinter();
    const migrationIssues = findMigrationBlockers({
      classDeclaration: component.cls,
      templateTypeChecker: context.checker.ng
    });
    if (migrationIssues) {
      reply.status(409).send(migrationIssues);
      return;
    }
    console.log("about to migrate");
    toStandalone(component.cls, context, printer);
    context.server.shut();
    reply.status(200).send();
  });
};
function findMigrationBlockers(data) {
  const { classDeclaration, templateTypeChecker } = data;
  const owningModule = templateTypeChecker.getOwningNgModule(classDeclaration);
  const selector = templateTypeChecker.getDirectiveMetadata(classDeclaration)?.selector;
  if (!selector)
    throw Error(
      "Cannot check templates for usage if component has no selector."
    );
  const sameModuleConsumers = context.elements.filter((potentialConsumer) => {
    if (potentialConsumer.type !== "Component" /* Component */) return false;
    const potentialConsumerOwningModule = templateTypeChecker.getOwningNgModule(
      potentialConsumer.cls
    );
    if (!potentialConsumerOwningModule) return false;
    if (owningModule !== potentialConsumerOwningModule) return false;
    const template = getTemplateOrNull(potentialConsumer.decorator.node);
    if (!template) return false;
    return getAllXmlTags(template).includes(selector);
  });
  if (sameModuleConsumers.length === 0) {
    return null;
  }
  const sameModuleDependencies = context.elements.find((_) => _.cls === classDeclaration)?.dependencies().filter(
    (_) => templateTypeChecker.getOwningNgModule(_.node) === owningModule
  ) ?? [];
  if (sameModuleDependencies.length === 0) {
    return null;
  }
  const componentName = classDeclaration.name?.text;
  const owningModuleName = owningModule.name?.text;
  return {
    error: "Migration would result in circular dependecy.",
    details: `${componentName} is currently declared in ${owningModuleName}. There are ${sameModuleConsumers.length} component(s) declared in that module depending on ${componentName}. There are also ${sameModuleDependencies.length} dependencies declared in that module ${componentName} uses. Migrating ${componentName} would result in circular dependecy. Migrate either said consumers or dependencies first to prevent this issue.`,
    consumers: sameModuleConsumers.map((_) => _.cls.name?.text),
    dependencies: sameModuleDependencies.map((_) => _.node.name.text)
  };
}
function toStandalone(toMigrate, context2, printer, fileImportRemapper, declarationImportRemapper) {
  const { program } = context2;
  const tree = context2.schematic.tree;
  const templateTypeChecker = program.compiler.getTemplateTypeChecker();
  const typeChecker = program.getTsProgram().getTypeChecker();
  const declarations = /* @__PURE__ */ new Set();
  const tracker = new ChangeTracker(printer, fileImportRemapper);
  convertNgModuleDeclarationToStandalone(
    toMigrate,
    declarations,
    tracker,
    templateTypeChecker,
    declarationImportRemapper
  );
  importNewStandaloneInConsumers({ toMigrate, tracker });
  const pendingChanges = tracker.recordChanges();
  for (const [file, changes] of pendingChanges.entries()) {
    const update = tree.beginUpdate((0, import_path3.relative)(process.cwd(), file.fileName));
    changes.forEach((change) => {
      if (change.removeLength != null) {
        update.remove(change.start, change.removeLength);
      }
      update.insertRight(change.start, change.text);
    });
    tree.commitUpdate(update);
  }
}
function convertNgModuleDeclarationToStandalone(decl, soonToBeStandalone, tracker, typeChecker, importRemapper) {
  const directiveMeta = typeChecker.getDirectiveMetadata(decl);
  if (directiveMeta && directiveMeta.decorator && !directiveMeta.isStandalone) {
    let decorator = markDecoratorAsStandalone(directiveMeta.decorator);
    if (directiveMeta.isComponent) {
      const importsToAdd = getComponentImportExpressions(
        decl,
        soonToBeStandalone,
        tracker,
        typeChecker,
        importRemapper
      );
      if (importsToAdd.length > 0) {
        const hasTrailingComma = importsToAdd.length > 2 && !!extractMetadataLiteral2(directiveMeta.decorator)?.properties.hasTrailingComma;
        decorator = setPropertyOnAngularDecorator(
          decorator,
          "imports",
          import_typescript13.default.factory.createArrayLiteralExpression(
            // Create a multi-line array when it has a trailing comma.
            import_typescript13.default.factory.createNodeArray(importsToAdd, hasTrailingComma),
            hasTrailingComma
          )
        );
      }
    }
    tracker.replaceNode(directiveMeta.decorator, decorator);
  } else {
    const pipeMeta = typeChecker.getPipeMetadata(decl);
    if (pipeMeta && pipeMeta.decorator && !pipeMeta.isStandalone) {
      tracker.replaceNode(
        pipeMeta.decorator,
        markDecoratorAsStandalone(pipeMeta.decorator)
      );
    }
  }
}
function importNewStandaloneInConsumers(data) {
  const { toMigrate: decl, tracker } = data;
  const toMigrateMeta = context.checker.ng.getDirectiveMetadata(decl);
  if (!toMigrateMeta) return;
  const selectorToMigrate = toMigrateMeta.selector;
  if (!selectorToMigrate) return;
  const directConsumers = context.elements.filter((el) => {
    if (el.type !== "Component" /* Component */) return false;
    console.log("checking", el.cls.name?.getText());
    const template = getTemplateOrNull(el.decorator.node);
    if (!template) return null;
    const tags = getAllXmlTags(template);
    const hit = tags.includes(selectorToMigrate);
    if (hit) console.log("HIT!");
    return hit;
  }).map((consumer) => ({
    ...consumer,
    owningModule: context.checker.ng.getOwningNgModule(consumer.cls)
  }));
  const modulesToUpdate = [
    ...new Set(directConsumers.map((_) => _.owningModule))
  ].filter(Boolean);
  const standaloneToUpdate = directConsumers.filter((_) => !_.owningModule).map((_) => _.cls);
  const toUpdate = [...modulesToUpdate, ...standaloneToUpdate];
  for (let importTarget of toUpdate) {
    if (!importTarget || !decl.name?.text) continue;
    if (!isClassImported({
      classDeclaration: decl,
      sourceFile: importTarget.getSourceFile(),
      typeChecker: context.checker.ts
    })) {
      tracker.addImport(
        importTarget.getSourceFile(),
        decl.name.text,
        // drop '.ts' extension from final import path
        (0, import_path3.relative)(context.basePath, decl.getSourceFile().fileName).slice(0, -3)
      );
    }
    addImportToModuleLike({ import: decl, to: importTarget, tracker });
  }
}
function getTemplateOrNull(decorator) {
  const templateUrl = getTemplateUrlOrNull(decorator);
  const componentDirectory = (0, import_path3.dirname)(decorator.getSourceFile().fileName);
  if (!templateUrl) return null;
  const relativeTemplateUrl = (0, import_path3.relative)(
    process.cwd(),
    `${componentDirectory}/${templateUrl}`
  );
  return readFileAsString(relativeTemplateUrl);
}
function getTemplateUrlOrNull(decorator) {
  const metadata = extractMetadataLiteral2(decorator);
  if (!metadata) return null;
  const templateUrlLiteral = findLiteralProperty(metadata, "templateUrl");
  if (!templateUrlLiteral) return null;
  if (!import_typescript13.default.isPropertyAssignment(templateUrlLiteral)) return null;
  let relativeTemplateUrl = templateUrlLiteral.initializer.getText();
  if (!relativeTemplateUrl) return null;
  return relativeTemplateUrl.slice(1, -1);
}
function getAllXmlTags(xmlString) {
  const parser = new import_fast_xml_parser.XMLParser();
  try {
    let traverse2 = function(obj) {
      if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            tagNames.push(key);
            traverse2(obj[key]);
          }
        }
      }
    };
    var traverse = traverse2;
    const xmlDoc = parser.parse(xmlString);
    const tagNames = [];
    traverse2(xmlDoc);
    return [...new Set(tagNames)];
  } catch (error) {
    console.error("XML Parsing Error:", error);
    return [];
  }
}
function readFileAsString(absolutePath) {
  try {
    const data = fs.readFileSync(absolutePath, "utf8");
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}
function getComponentImportExpressions(decl, soonToBeStandalone, tracker, typeChecker, importRemapper) {
  const templateDependencies = findTemplateDependencies2(decl, typeChecker);
  const templateDependenciesSoonStandalone = new Set(
    templateDependencies.filter((dep) => soonToBeStandalone.has(dep.node))
  );
  const seenImports = /* @__PURE__ */ new Set();
  const resolvedDependencies = [];
  for (const dep of templateDependencies) {
    const importLocation = findImportLocation(
      dep,
      decl,
      templateDependenciesSoonStandalone.has(dep) ? 1 : 0,
      // ? PotentialImportMode.ForceDirect
      // : PotentialImportMode.Normal,
      typeChecker
    );
    if (importLocation && !seenImports.has(importLocation.symbolName)) {
      seenImports.add(importLocation.symbolName);
      resolvedDependencies.push(importLocation);
    }
  }
  return potentialImportsToExpressions(
    resolvedDependencies,
    decl.getSourceFile(),
    tracker,
    importRemapper
  );
}
function potentialImportsToExpressions(potentialImports, toFile, tracker, importRemapper) {
  const processedDependencies = importRemapper ? importRemapper(potentialImports) : potentialImports;
  return processedDependencies.map((importLocation) => {
    if (importLocation.moduleSpecifier) {
      return tracker.addImport(
        toFile,
        importLocation.symbolName,
        importLocation.moduleSpecifier
      );
    }
    const identifier = import_typescript13.default.factory.createIdentifier(importLocation.symbolName);
    if (!importLocation.isForwardReference) {
      return identifier;
    }
    const forwardRefExpression = tracker.addImport(
      toFile,
      "forwardRef",
      "@angular/core"
    );
    const arrowFunction = import_typescript13.default.factory.createArrowFunction(
      void 0,
      void 0,
      [],
      void 0,
      void 0,
      identifier
    );
    return import_typescript13.default.factory.createCallExpression(forwardRefExpression, void 0, [
      arrowFunction
    ]);
  });
}
function addImportToModuleLike(data) {
  if (!data.import.name)
    throw new Error("Class to be imported has no name (?)");
  const decorator = context.checker.ng.getPrimaryAngularDecorator(data.to);
  if (!decorator)
    throw new Error(`${data.to.name?.text} has no angular decorator.`);
  const meta = extractMetadataLiteral2(decorator);
  if (!meta)
    throw new Error(`${data.to.name?.text} decorator has no arguments.`);
  const importsProperty = findLiteralProperty(meta, "imports");
  const hasAnyArrayTrailingComma = meta.properties.some(
    (prop) => import_typescript13.default.isPropertyAssignment(prop) && import_typescript13.default.isArrayLiteralExpression(prop.initializer) && prop.initializer.elements.hasTrailingComma
  );
  const newImport = import_typescript13.default.factory.createIdentifier(data.import.name.text);
  const properties = [];
  for (const prop of meta.properties) {
    if (!isNamedPropertyAssignment(prop)) {
      properties.push(prop);
      continue;
    }
    if (prop === importsProperty) {
      let initializer;
      if (import_typescript13.default.isArrayLiteralExpression(prop.initializer)) {
        initializer = import_typescript13.default.factory.updateArrayLiteralExpression(
          prop.initializer,
          import_typescript13.default.factory.createNodeArray(
            [...prop.initializer.elements, newImport],
            prop.initializer.elements.hasTrailingComma
          )
        );
      } else {
        initializer = import_typescript13.default.factory.createArrayLiteralExpression(
          import_typescript13.default.factory.createNodeArray(
            [import_typescript13.default.factory.createSpreadElement(prop.initializer), newImport],
            // Expect the declarations to be greater than 1 since
            // we have the pre-existing initializer already.
            hasAnyArrayTrailingComma
          )
        );
      }
      properties.push(
        import_typescript13.default.factory.updatePropertyAssignment(prop, prop.name, initializer)
      );
      continue;
    }
    properties.push(prop);
  }
  data.tracker.replaceNode(
    meta,
    import_typescript13.default.factory.updateObjectLiteralExpression(
      meta,
      import_typescript13.default.factory.createNodeArray(properties, meta.properties.hasTrailingComma)
    ),
    import_typescript13.default.EmitHint.Expression
  );
}
function markDecoratorAsStandalone(node) {
  const metadata = extractMetadataLiteral2(node);
  if (metadata === null || !import_typescript13.default.isCallExpression(node.expression)) {
    return node;
  }
  const standaloneProp = metadata.properties.find((prop) => {
    return isNamedPropertyAssignment(prop) && prop.name.text === "standalone";
  });
  if (!standaloneProp || standaloneProp.initializer.kind !== import_typescript13.default.SyntaxKind.FalseKeyword) {
    return node;
  }
  const newProperties = metadata.properties.filter(
    (element) => element !== standaloneProp
  );
  return import_typescript13.default.factory.createDecorator(
    import_typescript13.default.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        import_typescript13.default.factory.createObjectLiteralExpression(
          import_typescript13.default.factory.createNodeArray(
            newProperties,
            metadata.properties.hasTrailingComma
          ),
          newProperties.length > 1
        )
      ]
    )
  );
}
function setPropertyOnAngularDecorator(node, name, initializer) {
  if (!import_typescript13.default.isCallExpression(node.expression) || node.expression.arguments.length > 1) {
    return node;
  }
  let literalProperties;
  let hasTrailingComma = false;
  if (node.expression.arguments.length === 0) {
    literalProperties = [
      import_typescript13.default.factory.createPropertyAssignment(name, initializer)
    ];
  } else if (import_typescript13.default.isObjectLiteralExpression(node.expression.arguments[0])) {
    const literal = node.expression.arguments[0];
    const existingProperty = findLiteralProperty(literal, name);
    hasTrailingComma = literal.properties.hasTrailingComma;
    if (existingProperty && import_typescript13.default.isPropertyAssignment(existingProperty)) {
      literalProperties = literal.properties.slice();
      literalProperties[literalProperties.indexOf(existingProperty)] = import_typescript13.default.factory.updatePropertyAssignment(
        existingProperty,
        existingProperty.name,
        initializer
      );
    } else {
      literalProperties = [
        ...literal.properties,
        import_typescript13.default.factory.createPropertyAssignment(name, initializer)
      ];
    }
  } else {
    return node;
  }
  return import_typescript13.default.factory.createDecorator(
    import_typescript13.default.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        import_typescript13.default.factory.createObjectLiteralExpression(
          import_typescript13.default.factory.createNodeArray(literalProperties, hasTrailingComma),
          literalProperties.length > 1
        )
      ]
    )
  );
}
function isNamedPropertyAssignment(node) {
  return import_typescript13.default.isPropertyAssignment(node) && node.name && import_typescript13.default.isIdentifier(node.name);
}
function findImportLocation(target, inContext, importMode, typeChecker) {
  const importLocations = typeChecker.getPotentialImportsFor(
    target,
    inContext,
    importMode
  );
  let firstSameFileImport = null;
  let firstModuleImport = null;
  for (const location of importLocations) {
    if (location.kind === 1) {
      return location;
    }
    if (!location.moduleSpecifier && !firstSameFileImport) {
      firstSameFileImport = location;
    }
    if (
      // location.kind === PotentialImportKind.NgModule &&
      location.kind === 0 && !firstModuleImport && // ɵ is used for some internal Angular modules that we want to skip over.
      !location.symbolName.startsWith("\u0275")
    ) {
      firstModuleImport = location;
    }
  }
  return firstSameFileImport || firstModuleImport || importLocations[0] || null;
}
function findTemplateDependencies2(decl, typeChecker) {
  const results = [];
  const usedDirectives = typeChecker.getUsedDirectives(decl);
  const usedPipes = typeChecker.getUsedPipes(decl);
  if (usedDirectives !== null) {
    for (const dir of usedDirectives) {
      if (import_typescript13.default.isClassDeclaration(dir.ref.node)) {
        results.push(dir.ref);
      }
    }
  }
  if (usedPipes !== null) {
    const potentialPipes = typeChecker.getPotentialPipes(decl);
    for (const pipe of potentialPipes) {
      if (import_typescript13.default.isClassDeclaration(pipe.ref.node) && usedPipes.some((current) => pipe.name === current)) {
        results.push(pipe.ref);
      }
    }
  }
  return results;
}
function extractMetadataLiteral2(decorator) {
  return import_typescript13.default.isCallExpression(decorator.expression) && decorator.expression.arguments.length === 1 && import_typescript13.default.isObjectLiteralExpression(decorator.expression.arguments[0]) ? decorator.expression.arguments[0] : null;
}
function findLiteralProperty(literal, name) {
  return literal.properties.find(
    (prop) => prop.name && import_typescript13.default.isIdentifier(prop.name) && prop.name.text === name
  );
}

// src/main.ts
var context = {
  program: null,
  basePath: null,
  schematic: null,
  checker: null,
  elements: null,
  source: null
};
function dependencyVisualizer(_options) {
  return async (tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");
    for (const tsconfigPath of buildPaths) {
      await analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        createProgram
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
    void 0,
    void 0,
    {
      _enableTemplateTypeChecker: true,
      compileNonExportedClasses: true,
      // Avoid checking libraries to speed up the migration.
      skipLibCheck: true,
      skipDefaultLibCheck: true
    }
  );
  const program = data.createProgram({
    rootNames,
    host,
    options
  });
  const tsChecker = program.getTsProgram().getTypeChecker();
  const ngChecker = program.compiler.getTemplateTypeChecker();
  const sourceFiles = program.getTsProgram().getSourceFiles();
  const fileTree = makeFileTree(sourceFiles);
  const elements = sourceFiles.flatMap(
    (file) => findNgClasses(file, tsChecker)
  );
  context.program = program;
  context.schematic = { tree: data.tree };
  context.source = { files: sourceFiles, tree: fileTree };
  context.checker = { ts: tsChecker, ng: ngChecker };
  context.elements = elements;
  const fastify = (0, import_fastify.default)();
  fastify.register(import_static.default, {
    root: import_path4.default.join(__dirname, "static"),
    prefix: "/static/"
  });
  fastify.register(api_default, { prefix: "/api" });
  fastify.register(toStandaloneRoute, { prefix: "/api" });
  fastify.listen({ port: 3e3 }, (err, address) => {
    if (err) throw err;
    console.log(`Listening on ${address}`);
  });
  const createSignal = () => {
    const promiseObj = { resolve() {
    }, reject() {
    } };
    const promise = new Promise((resolve3, reject) => {
      promiseObj.resolve = () => resolve3(void 0);
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
    }
  };
  await shutdownSignal.instance;
  console.log("Script finished.");
}
function makeFileTree(sourceFiles) {
  const fileTree = {};
  sourceFiles.filter((file) => !file.fileName.includes("node_modules")).forEach((file) => {
    const pathSegments = file.fileName.split("/").filter((_) => _);
    let currentFolder = fileTree;
    pathSegments.forEach((segment) => {
      if (segment.includes(".")) {
        currentFolder[segment] = file;
      }
      if (!currentFolder[segment]) {
        currentFolder[segment] = {};
      }
      currentFolder = currentFolder[segment];
    });
  });
  return fileTree;
}
var ngElements = Object.values(NgElementType);
function findNgClasses(sourceFile, typeChecker) {
  const modules = [];
  const fileHasNgElements = ngElements.some(
    (element) => getImportSpecifier(sourceFile, "@angular/core", element)
  );
  if (!fileHasNgElements) return modules;
  sourceFile.forEachChild(function walk(node) {
    analyseClass: if (import_typescript14.default.isClassDeclaration(node)) {
      const ngDecorator = getAngularDecorators(
        typeChecker,
        import_typescript14.default.getDecorators(node) || []
      ).find((current) => ngElements.includes(current.name));
      if (!ngDecorator) break analyseClass;
      const metadata = ngDecorator ? extractMetadataLiteral(ngDecorator.node) : null;
      if (!metadata) break analyseClass;
      modules.push({
        cls: node,
        decorator: ngDecorator,
        type: ngDecorator.name,
        dependencies() {
          if (!this.__templateDependencies) {
            this.__templateDependencies = findTemplateDependencies(
              this.cls,
              context.checker.ng
            );
          }
          return this.__templateDependencies;
        }
      });
    }
    node.forEachChild(walk);
  });
  return modules;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  context,
  dependencyVisualizer
});
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
