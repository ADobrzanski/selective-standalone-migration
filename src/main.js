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
    async readFile(path4) {
      const data = tree.read(path4);
      if (!data) {
        throw new Error("File not found.");
      }
      const core = await import("@angular-devkit/core");
      return core.virtualFs.fileBufferToString(data);
    },
    async writeFile(path4, data) {
      return tree.overwrite(path4, data);
    },
    async isDirectory(path4) {
      return !tree.exists(path4) && tree.getDir(path4).subfiles.length > 0;
    },
    async isFile(path4) {
      return tree.exists(path4);
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
var import_typescript17 = __toESM(require("typescript"));

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

// src/main.ts
var import_http = __toESM(require("http"));

// src/tsc.helpers.ts
var import_typescript5 = __toESM(require("typescript"));
var isSourceFile = (x) => x !== null && typeof x === "object" && "kind" in x && x.kind === import_typescript5.SyntaxKind.SourceFile;
var getLocalNodeId = (node) => `${node.kind}-${node.pos}-${node.end}`;
var getGlobalNodeId = (node) => `${node.getSourceFile().fileName}$$${node.kind}$$${node.pos}$$${node.end}`;
var getDataFromGlobalNodeId = (globalNodeId) => {
  const [fileName, _kind, _pos, _end] = globalNodeId.split("$$");
  return {
    fileName,
    kind: Number(_kind),
    pos: Number(_pos),
    end: Number(_end)
  };
};
var getAllChildren = (node) => {
  const children = [];
  node.forEachChild((child) => {
    children.push(child);
  });
  return children;
};
var getAllChildrenDeep = (node) => {
  const children = [];
  node.forEachChild((child) => {
    children.push(child, ...getAllChildrenDeep(child));
  });
  return children;
};
var getClassDeclarationForImportedIdentifier = (typeChecker, node) => {
  const localSymbol = typeChecker.getSymbolAtLocation(node);
  const importSpecifier = localSymbol?.getDeclarations()?.find(import_typescript5.default.isImportSpecifier);
  const importSpecifierNameSymbol = importSpecifier?.name && typeChecker.getSymbolAtLocation(importSpecifier?.name);
  const importSpecifierNameAliasedSymbol = importSpecifierNameSymbol && typeChecker.getAliasedSymbol(importSpecifierNameSymbol);
  const importSpecifierNameAliasedSymbolDeclarations = importSpecifierNameAliasedSymbol && importSpecifierNameAliasedSymbol.getDeclarations();
  return importSpecifierNameAliasedSymbolDeclarations?.find(
    import_typescript5.default.isClassDeclaration
  );
};
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

// src/ts.helpers.ts
function isNil(x) {
  return x === null || x === void 0;
}
var isObject = (x) => {
  return x !== null && typeof x === "object";
};

// src/helpers.ts
function getAtPath(obj, path4) {
  let currentRoot = obj;
  const pathSegments = path4.split("/");
  for (let segment of pathSegments) {
    if (segment in currentRoot) {
      currentRoot = currentRoot[segment];
    } else {
      currentRoot = void 0;
      break;
    }
  }
  return currentRoot;
}

// src/html.helpers.ts
var getDocument = (body, css, script) => `<!DOCTYPE html><html><head><style>${css ?? ""}</style> <script src="https://unpkg.com/htmx.org@2.0.1">${script ?? ""}</script></head><body>${body}</body></html>`;
var getLink = (data) => `<a href="${data.href}">${data.label}</a>`;
var getTag = (name, attributes, content) => {
  const attributeString = Object.entries(attributes ?? {}).filter(([_key, value]) => !isNil(value)).map(([key, value]) => `${key}="${value}"`).join(" ");
  return `<${name} ${attributeString}>${content ?? ""}</${name}>`;
};
var div = (attributes, content) => getTag("div", attributes, content);
var ul = (attributes, content) => getTag("ul", attributes, content);
var li = (attributes, content) => getTag("li", attributes, content);
var a = (attributes, content) => getTag("a", attributes, content);
var pre = (attributes, content) => getTag("pre", attributes, content);
var renderComponentListItemEntry = (declaration, ngChecker) => {
  const href = declaration ? `/component/${encodeURIComponent(getGlobalNodeId(declaration))}` : null;
  return a(
    { href, style: "display: block;" },
    `- ${declaration.name?.escapedText} (${ngChecker.getOwningNgModule(declaration)?.name?.escapedText})`
  );
};

// src/routes/file.ts
var import_typescript6 = __toESM(require("typescript"));
var handleFile = (url, _req, res, _server, context2) => {
  const fsPathSegment = url.pathname.substring(1);
  const fsPath = url.searchParams.get("path") ?? fsPathSegment;
  const fsTreeNode = !fsPath ? context2.source.tree : getAtPath(context2.source.tree, fsPath);
  const getTreeLink = (fsPathSegment2) => {
    const href = encodeURIComponent(
      [fsPath, fsPathSegment2].filter((_) => _).join("/")
    );
    const label = fsPathSegment2;
    return getLink({ href: `?path=${href}`, label }) + "<br>";
  };
  const html = isSourceFile(fsTreeNode) ? renderFile(fsTreeNode) : Object.entries(fsTreeNode).map(
    ([fsPathSegment2]) => getTreeLink(fsPathSegment2)
  );
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
          <!DOCTYPE html>
          <html>
          <body>
            ${html}
          </body>
          </html>
        `);
};
var renderFile = (tsFile) => {
  const css = `
      .columns {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
      }

      .node {
        margin-left: 8px;
      }
    `;
  const content = `
      <div class="columns">
        <pre class="scroll">${tsFile.text}</pre>
        <div class="scroll">${getAllChildren(tsFile).map(renderNode).join("")}</div>
        <pre id="node" class="scroll"></pre>
      </div>
    `;
  return getDocument(content, css);
};
var renderNode = (node) => {
  const filePath = encodeURIComponent(node.getSourceFile().fileName);
  return `
      <div class="node">
        <div hx-get="file/${filePath}/node/${getLocalNodeId(node)}" hx-target="#node">${import_typescript6.default.SyntaxKind[node.kind]}</div>
        ${getAllChildren(node).map(renderNode).join("")}
      </div>
    `;
};

// src/routes/shutdown.ts
var handleShutdown = (_url, _req, res, server) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server is shutting down...");
  setTimeout(() => {
    server.close(() => {
      console.log("Server has been shut down.");
    });
  }, 100);
};

// src/routes/file/node.ts
var import_typescript7 = require("typescript");
var handleNodeInFile = (_url, _req, res, _server, context2) => {
  const [_0, _fsPath, _2, nodeId] = _url.pathname.substring(1).split("/");
  const fsPath = decodeURIComponent(_fsPath).substring(1);
  console.log("fsPath", fsPath);
  const fsTreeNode = getAtPath(context2.source.tree, fsPath);
  if (!(0, import_typescript7.isSourceFile)(fsTreeNode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Path does not point to the file.");
    return;
  }
  const children = getAllChildrenDeep(fsTreeNode);
  const node = children.find((_node) => getLocalNodeId(_node) === nodeId);
  if (!node) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`There is no node with id = ${nodeId} in ${fsPath}.`);
    return;
  }
  const entriesHTML = shallowStringifyToHTML(node);
  const symbol = context2.checker.ts.getSymbolAtLocation(node);
  const symbolHTML = symbol ? shallowStringifyToHTML(symbol) : "";
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    [entriesHTML, getTag("div", void 0, "Symbol: ------"), symbolHTML].join(
      ""
    )
  );
};
var shallowStringifyToHTML = (x) => {
  const entries = Object.entries(x);
  return entries.reduce((acc, [key, value]) => {
    const valueString = isObject(value) ? value["constructor"]["name"] : key === "kind" && typeof value === "number" ? import_typescript7.SyntaxKind[value] : value + "";
    return acc + `<div>${key}: ${valueString}</div>`;
  }, "");
};

// src/routes/graph.ts
var import_path2 = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var handleGraph = (_url, _req, res) => {
  const filePath = import_path2.default.join(__dirname, "templates/graph.html");
  import_fs.default.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.log(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Cannot load template file");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
};

// src/types/ng-element.enum.ts
var NgElementType = /* @__PURE__ */ ((NgElementType2) => {
  NgElementType2["Directive"] = "Directive";
  NgElementType2["Component"] = "Component";
  NgElementType2["NgModule"] = "NgModule";
  NgElementType2["Pipe"] = "Pipe";
  return NgElementType2;
})(NgElementType || {});

// src/angular-tsc.helpers.ts
var import_typescript10 = __toESM(require("typescript"));

// utils/typescript/decorators.ts
var import_typescript9 = __toESM(require("typescript"));

// utils/typescript/imports.ts
var import_typescript8 = __toESM(require("typescript"));

// src/angular-tsc.helpers.ts
function findTemplateDependencies(decl, typeChecker) {
  const results = [];
  const usedDirectives = typeChecker.getUsedDirectives(decl);
  const usedPipes = typeChecker.getUsedPipes(decl);
  if (usedDirectives !== null) {
    for (const dir of usedDirectives) {
      if (import_typescript10.default.isClassDeclaration(dir.ref.node)) {
        results.push(dir.ref);
      }
    }
  }
  if (usedPipes !== null) {
    const potentialPipes = typeChecker.getPotentialPipes(decl);
    for (const pipe of potentialPipes) {
      if (import_typescript10.default.isClassDeclaration(pipe.ref.node) && usedPipes.some((current) => pipe.name === current)) {
        results.push(pipe.ref);
      }
    }
  }
  return results;
}
var knownNgElementTypes = Object.values(NgElementType);

// src/routes/component.ts
var handleComponent = (_url, _req, res, _server, context2) => {
  const [_0, _globalNodeId] = _url.pathname.substring(1).split("/");
  const globalNodeId = decodeURIComponent(_globalNodeId);
  console.log("globalNodeId", globalNodeId);
  const nodeData = getDataFromGlobalNodeId(globalNodeId);
  const fsTreeNode = getAtPath(
    context2.source.tree,
    nodeData.fileName.substring(1)
  );
  if (!isSourceFile(fsTreeNode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Path does not point to the file.");
    return;
  }
  const component = context2.elements.filter((element) => element.type === "Component" /* Component */).find((component2) => getGlobalNodeId(component2.cls) === globalNodeId);
  if (!component) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Component not found in file.");
    return;
  }
  const getDirectiveMetadata2 = (cls) => context2.checker.ng.getDirectiveMetadata(cls);
  const isStandalone = (cls) => getDirectiveMetadata2(cls)?.isStandalone;
  const getOwningNgModule2 = (cls) => context2.checker.ng.getOwningNgModule(cls);
  const meta = getDirectiveMetadata2(component.cls);
  const declaredIn = getOwningNgModule2(component.cls);
  function findDependencies(cls) {
    return findTemplateDependencies(cls, context2.checker.ng).map(
      ({ node }) => ({
        cls: node,
        deps: findDependencies(node)
      })
    );
  }
  function renderDependencies(deps) {
    return ul(
      null,
      deps.map(
        (dep) => li(
          { style: `color: ${isStandalone(dep.cls) ? "green" : "inherit"}` },
          dep.cls.name?.escapedText.toString() + (dep.deps.length === 0 ? "" : renderDependencies(dep.deps))
        )
      ).join("")
    );
  }
  const title = [
    div(null, `Name: ${component.cls.name?.escapedText}`),
    div(null, `- selector: ${meta?.selector}`),
    div(
      null,
      `Declared in: ${isStandalone(component.cls) ? "standalone" : declaredIn?.name?.escapedText ?? "unresolved"}`
    )
  ].join("");
  const componentsHTML = [
    div(null, "Dependencies:"),
    renderDependencies(findDependencies(component.cls)),
    a(
      {
        href: `/migrate-single/${encodeURIComponent(getGlobalNodeId(component.cls))}`
      },
      "Make standalone"
    ),
    pre(
      null,
      context2.checker.ng.getTemplate(component.cls)?.map((_) => _.sourceSpan.toString()).join()
    )
  ].join("");
  const html = [title, componentsHTML].join(`<hr>`);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(html));
};

// src/routes/modules.ts
var import_typescript11 = __toESM(require("typescript"));
var handleModules = (_url, _req, res, _server, context2) => {
  const ngModules = context2.elements.filter((element) => element.type === "NgModule" /* NgModule */).map((module2) => {
    let declarations = [];
    const metadata = module2 && extractMetadataLiteral(module2.decorator.node);
    if (!metadata) return { ...module2, declarations };
    const declarationsNode = findLiteralProperty(metadata, "declarations");
    if (!declarationsNode || !hasNgModuleMetadataElements(declarationsNode))
      return { ...module2, declarations };
    declarations = getAllChildren(declarationsNode.initializer).filter((node) => import_typescript11.default.isIdentifier(node)).map((node) => {
      return {
        name: node,
        class: getClassDeclarationForImportedIdentifier(
          context2.checker.ts,
          node
        )
      };
    });
    return { ...module2, declarations };
  });
  const content = ngModules.reduce((acc, ngModule) => {
    const moduleId = getGlobalNodeId(ngModule.cls);
    const name = a(
      { href: `/module/${encodeURIComponent(moduleId)}`, class: "block" },
      ngModule.cls.name?.text ?? "NgModule (name unresolvable)"
    );
    return acc + name;
  }, "");
  const css = `
      .block { display: block; }
    `;
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content, css));
};
function findLiteralProperty(literal, name) {
  return literal.properties.find(
    (prop) => prop.name && import_typescript11.default.isIdentifier(prop.name) && prop.name.text === name
  );
}
function hasNgModuleMetadataElements(node) {
  return import_typescript11.default.isPropertyAssignment(node) && (!import_typescript11.default.isArrayLiteralExpression(node.initializer) || node.initializer.elements.length > 0);
}

// src/routes/tests.ts
var import_typescript12 = __toESM(require("typescript"));
var handleTests = (_url, _req, res, _server, context2) => {
  const testFiles = context2.source.files.filter((file) => {
    console.log(file.fileName);
    return file.fileName.endsWith("spec.ts");
  });
  const content = ul(
    null,
    testFiles.map((file) => li(null, file.fileName)).join("")
  );
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content));
};

// src/routes/static.ts
var import_path3 = __toESM(require("path"));
var import_fs2 = __toESM(require("fs"));
var handleStatic = (_url, _req, res) => {
  const [_0, fileName] = _url.pathname.substring(1).split("/");
  const extention = fileName.split(".")[1];
  const filePath = import_path3.default.join(__dirname, `static/${fileName}`);
  import_fs2.default.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.log(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Cannot load template file");
      return;
    }
    switch (extention) {
      case "html":
        res.writeHead(200, { "Content-Type": "text/html" });
        break;
      case "js":
        res.writeHead(200, { "Content-Type": "text/javascript" });
        break;
      default:
        throw new Error("Unsupported file extension");
    }
    res.end(data);
  });
};

// src/routes/migrate-single.ts
var import_typescript16 = __toESM(require("typescript"));

// utils/change_tracker.ts
var import_typescript14 = __toESM(require("typescript"));

// utils/import_manager.ts
var import_path4 = require("path");
var import_typescript13 = __toESM(require("typescript"));
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
    const sourceDir = (0, import_path4.dirname)(sourceFile.fileName);
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
      if (!import_typescript13.default.isImportDeclaration(statement) || !import_typescript13.default.isStringLiteral(statement.moduleSpecifier) || !statement.importClause) {
        continue;
      }
      if (importStartIndex === 0) {
        importStartIndex = this._getEndPositionOfNode(statement);
      }
      const moduleSpecifier = statement.moduleSpecifier.text;
      if (moduleSpecifier.startsWith(".") && (0, import_path4.resolve)(sourceDir, moduleSpecifier) !== (0, import_path4.resolve)(sourceDir, moduleName) || moduleSpecifier !== moduleName) {
        continue;
      }
      if (statement.importClause.namedBindings) {
        const namedBindings = statement.importClause.namedBindings;
        if (import_typescript13.default.isNamespaceImport(namedBindings) && !typeImport) {
          return import_typescript13.default.factory.createPropertyAccessExpression(
            import_typescript13.default.factory.createIdentifier(namedBindings.name.text),
            import_typescript13.default.factory.createIdentifier(alias || symbolName || "default")
          );
        } else if (import_typescript13.default.isNamedImports(namedBindings) && symbolName) {
          const existingElement = namedBindings.elements.find((e) => {
            if (alias) {
              return e.propertyName && e.name.text === alias && e.propertyName.text === symbolName;
            }
            return e.propertyName ? e.propertyName.text === symbolName : e.name.text === symbolName;
          });
          if (existingElement) {
            return import_typescript13.default.factory.createIdentifier(existingElement.name.text);
          }
          existingImport = statement;
        }
      } else if (statement.importClause.name && !symbolName) {
        return import_typescript13.default.factory.createIdentifier(statement.importClause.name.text);
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
      importMap.get(moduleName).push(import_typescript13.default.factory.createImportSpecifier(false, propertyName, name));
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
      const newNamedBindings = import_typescript13.default.factory.updateNamedImports(
        namedBindings,
        namedBindings.elements.concat(
          expressions.map(
            ({ propertyName, importName }) => import_typescript13.default.factory.createImportSpecifier(false, propertyName, importName)
          )
        )
      );
      const newNamedBindingsText = this.printer.printNode(
        import_typescript13.default.EmitHint.Unspecified,
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
          const newImport = import_typescript13.default.factory.createImportDeclaration(
            void 0,
            import_typescript13.default.factory.createImportClause(false, identifier, void 0),
            import_typescript13.default.factory.createStringLiteral(moduleName, useSingleQuotes)
          );
          recorder.addNewImport(
            importStartIndex,
            this._getNewImportText(importStartIndex, newImport, sourceFile)
          );
        });
        namedImports.forEach((specifiers, moduleName) => {
          const newImport = import_typescript13.default.factory.createImportDeclaration(
            void 0,
            import_typescript13.default.factory.createImportClause(
              false,
              void 0,
              import_typescript13.default.factory.createNamedImports(specifiers)
            ),
            import_typescript13.default.factory.createStringLiteral(moduleName, useSingleQuotes)
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
      return import_typescript13.default.factory.createIdentifier(baseName);
    }
    let name = "";
    let counter = 1;
    do {
      name = `${baseName}_${counter++}`;
    } while (!this.isUniqueIdentifierName(sourceFile, name));
    this._recordUsedIdentifier(sourceFile, name);
    return import_typescript13.default.factory.createIdentifier(name);
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
      if (import_typescript13.default.isIdentifier(node) && node.text === name && // Identifiers that are aliased in an import aren't
      // problematic since they're used under a different name.
      (!import_typescript13.default.isImportSpecifier(node.parent) || node.parent.propertyName !== node)) {
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
    const commentRanges = import_typescript13.default.getTrailingCommentRanges(
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
      import_typescript13.default.EmitHint.Unspecified,
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
    const symbolIdentifier = import_typescript13.default.factory.createIdentifier(symbolName);
    const aliasIdentifier = alias ? import_typescript13.default.factory.createIdentifier(alias) : null;
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
        if (import_typescript13.default.isImportDeclaration(statement) && import_typescript13.default.isStringLiteralLike(statement.moduleSpecifier)) {
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
  replaceNode(oldNode, newNode, emitHint = import_typescript14.default.EmitHint.Unspecified, sourceFileWhenPrinting) {
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
function normalizePath(path4) {
  return path4.replace(/\\/g, "/");
}

// utils/typescript/nodes.ts
var import_typescript15 = __toESM(require("typescript"));

// src/routes/migrate-single.ts
var import_path5 = require("path");
var handleToStandaloneNew = (_url, _req, res, _server, context2) => {
  const [_0, _elementId] = _url.pathname.substring(1).split("/");
  const component = context2.elements.at(Number(_elementId));
  const printer = import_typescript16.default.createPrinter();
  if (!component) return;
  console.log("about to migrate");
  toStandalone(component.cls, context2, printer);
  context2.server.shut();
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Yeehaa");
};
function toStandalone(toMigrate, context2, printer, fileImportRemapper, declarationImportRemapper) {
  const { program } = context2;
  const tree = context2.schematic.tree;
  const templateTypeChecker = program.compiler.getTemplateTypeChecker();
  const declarations = /* @__PURE__ */ new Set();
  const tracker = new ChangeTracker(printer, fileImportRemapper);
  convertNgModuleDeclarationToStandalone(
    toMigrate,
    declarations,
    tracker,
    templateTypeChecker,
    declarationImportRemapper
  );
  const pendingChanges = tracker.recordChanges();
  console.log(pendingChanges);
  for (const [file, changes] of pendingChanges.entries()) {
    const update = tree.beginUpdate((0, import_path5.relative)(process.cwd(), file.fileName));
    changes.forEach((change) => {
      if (change.removeLength != null) {
        update.remove(change.start, change.removeLength);
      }
      update.insertRight(change.start, change.text);
    });
    tree.commitUpdate(update);
  }
}
function convertNgModuleDeclarationToStandalone(decl, allDeclarations, tracker, typeChecker, importRemapper) {
  const directiveMeta = typeChecker.getDirectiveMetadata(decl);
  if (directiveMeta && directiveMeta.decorator && !directiveMeta.isStandalone) {
    let decorator = markDecoratorAsStandalone(directiveMeta.decorator);
    if (directiveMeta.isComponent) {
      const importsToAdd = getComponentImportExpressions(
        decl,
        allDeclarations,
        tracker,
        typeChecker,
        importRemapper
      );
      if (importsToAdd.length > 0) {
        const hasTrailingComma = importsToAdd.length > 2 && !!extractMetadataLiteral2(directiveMeta.decorator)?.properties.hasTrailingComma;
        decorator = setPropertyOnAngularDecorator(
          decorator,
          "imports",
          import_typescript16.default.factory.createArrayLiteralExpression(
            // Create a multi-line array when it has a trailing comma.
            import_typescript16.default.factory.createNodeArray(importsToAdd, hasTrailingComma),
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
function getComponentImportExpressions(decl, allDeclarations, tracker, typeChecker, importRemapper) {
  const templateDependencies = findTemplateDependencies2(decl, typeChecker);
  const usedDependenciesInMigration = new Set(
    templateDependencies.filter((dep) => allDeclarations.has(dep.node))
  );
  const seenImports = /* @__PURE__ */ new Set();
  const resolvedDependencies = [];
  for (const dep of templateDependencies) {
    const importLocation = findImportLocation(
      dep,
      decl,
      usedDependenciesInMigration.has(dep) ? 1 : 0,
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
    const identifier = import_typescript16.default.factory.createIdentifier(importLocation.symbolName);
    if (!importLocation.isForwardReference) {
      return identifier;
    }
    const forwardRefExpression = tracker.addImport(
      toFile,
      "forwardRef",
      "@angular/core"
    );
    const arrowFunction = import_typescript16.default.factory.createArrowFunction(
      void 0,
      void 0,
      [],
      void 0,
      void 0,
      identifier
    );
    return import_typescript16.default.factory.createCallExpression(forwardRefExpression, void 0, [
      arrowFunction
    ]);
  });
}
function markDecoratorAsStandalone(node) {
  const metadata = extractMetadataLiteral2(node);
  if (metadata === null || !import_typescript16.default.isCallExpression(node.expression)) {
    return node;
  }
  const standaloneProp = metadata.properties.find((prop) => {
    return isNamedPropertyAssignment(prop) && prop.name.text === "standalone";
  });
  if (!standaloneProp || standaloneProp.initializer.kind !== import_typescript16.default.SyntaxKind.FalseKeyword) {
    return node;
  }
  const newProperties = metadata.properties.filter(
    (element) => element !== standaloneProp
  );
  return import_typescript16.default.factory.createDecorator(
    import_typescript16.default.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        import_typescript16.default.factory.createObjectLiteralExpression(
          import_typescript16.default.factory.createNodeArray(
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
  if (!import_typescript16.default.isCallExpression(node.expression) || node.expression.arguments.length > 1) {
    return node;
  }
  let literalProperties;
  let hasTrailingComma = false;
  if (node.expression.arguments.length === 0) {
    literalProperties = [
      import_typescript16.default.factory.createPropertyAssignment(name, initializer)
    ];
  } else if (import_typescript16.default.isObjectLiteralExpression(node.expression.arguments[0])) {
    const literal = node.expression.arguments[0];
    const existingProperty = findLiteralProperty2(literal, name);
    hasTrailingComma = literal.properties.hasTrailingComma;
    if (existingProperty && import_typescript16.default.isPropertyAssignment(existingProperty)) {
      literalProperties = literal.properties.slice();
      literalProperties[literalProperties.indexOf(existingProperty)] = import_typescript16.default.factory.updatePropertyAssignment(
        existingProperty,
        existingProperty.name,
        initializer
      );
    } else {
      literalProperties = [
        ...literal.properties,
        import_typescript16.default.factory.createPropertyAssignment(name, initializer)
      ];
    }
  } else {
    return node;
  }
  return import_typescript16.default.factory.createDecorator(
    import_typescript16.default.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        import_typescript16.default.factory.createObjectLiteralExpression(
          import_typescript16.default.factory.createNodeArray(literalProperties, hasTrailingComma),
          literalProperties.length > 1
        )
      ]
    )
  );
}
function isNamedPropertyAssignment(node) {
  return import_typescript16.default.isPropertyAssignment(node) && node.name && import_typescript16.default.isIdentifier(node.name);
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
      if (import_typescript16.default.isClassDeclaration(dir.ref.node)) {
        results.push(dir.ref);
      }
    }
  }
  if (usedPipes !== null) {
    const potentialPipes = typeChecker.getPotentialPipes(decl);
    for (const pipe of potentialPipes) {
      if (import_typescript16.default.isClassDeclaration(pipe.ref.node) && usedPipes.some((current) => pipe.name === current)) {
        results.push(pipe.ref);
      }
    }
  }
  return results;
}
function extractMetadataLiteral2(decorator) {
  return import_typescript16.default.isCallExpression(decorator.expression) && decorator.expression.arguments.length === 1 && import_typescript16.default.isObjectLiteralExpression(decorator.expression.arguments[0]) ? decorator.expression.arguments[0] : null;
}
function findLiteralProperty2(literal, name) {
  return literal.properties.find(
    (prop) => prop.name && import_typescript16.default.isIdentifier(prop.name) && prop.name.text === name
  );
}

// src/routes/api.ts
var respond = (res) => {
  return {
    with(opts) {
      if (typeof opts.data === "string") {
        res.writeHead(opts.code, { "Content-Type": "text/plain" });
        res.end(opts.data);
      } else {
        res.writeHead(opts.code, { "Content-Type": "text/json" });
        res.end(JSON.stringify(opts.data));
      }
    },
    ok(data) {
      return this.with({ data, code: 200 });
    },
    notFoundId(id) {
      return this.with({
        data: { details: `No element with ID equal ${id}.` },
        code: 404
      });
    },
    notOfType(opts) {
      return this.with({
        code: 404,
        data: {
          details: `Element with ID equal ${opts.id} is not ${opts.type}.`
        }
      });
    }
  };
};
var GET_component_list = (_url, _req, res, _server) => {
  const componentList = context.elements.map((element, id) => ({ ...element, id })).filter((element) => element.type === "Component" /* Component */).map((component) => getComponent(component.cls));
  respond(res).ok(componentList);
};
var GET_component = (url, _req, res, _server) => {
  const [_0, _path, idString] = getPathnameElements(url);
  const id = Number(idString);
  const element = context.elements.at(id);
  if (!element) {
    respond(res).notFoundId(id);
    return;
  }
  if (element.type !== "Component" /* Component */) {
    respond(res).notOfType({ id, type: "Component" /* Component */ });
    return;
  }
  respond(res).ok(getComponent(element.cls));
};
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
var GET_component_dependency_list = (url, _req, res, _server) => {
  const [_api, _componenet, idString, _dependency] = getPathnameElements(url);
  const id = Number(idString);
  const element = context.elements.at(id);
  if (!element) {
    return respond(res).notFoundId(id);
  }
  if (element.type !== "Component" /* Component */) {
    return respond(res).notOfType({ id, type: "Component" /* Component */ });
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
  respond(res).ok(dependencies);
};
var GET_component_consumer_list = (url, _req, res, _server) => {
  const [_api, _componenet, idString, _consumer] = getPathnameElements(url);
  const id = Number(idString);
  const element = context.elements.at(id);
  if (!element) {
    respond(res).notFoundId(id);
    return;
  }
  if (element.type !== "Component" /* Component */) {
    respond(res).notOfType({ id, type: "Component" /* Component */ });
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
  respond(res).ok(
    directConsumers.map((consumer) => {
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
    })
  );
};
var GET_component_dependency = (url, _req, res, _server) => {
  const [_api, _componenetId, idString, _dependency, depIdString] = getPathnameElements(url);
  const componentId = Number(idString);
  const depId = Number(depIdString);
  const component = context.elements.at(componentId);
  const dep = context.elements.at(depId);
  if (!component) return respond(res).notFoundId(componentId);
  if (component.type !== "Component" /* Component */)
    return respond(res).notOfType({
      id: componentId,
      type: "Component" /* Component */
    });
  if (!dep) return respond(res).notFoundId(depId);
  const templateDependencyTypes = [
    "Component" /* Component */,
    "Directive" /* Directive */,
    "Pipe" /* Pipe */
  ];
  if (templateDependencyTypes.includes(dep.type))
    return respond(res).notOfType({
      id: depId,
      type: templateDependencyTypes.join(", ")
    });
  if (dep.type === "Component" /* Component */ || dep.type === "Directive" /* Directive */) {
    respond(res).ok(getDirective(dep.cls));
  } else {
    respond(res).ok(getPipe(dep.cls));
  }
};
var getPathnameElements = (url) => {
  return url.pathname.substring(1).split("/");
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

// src/routes/components.ts
var handleComponents = (_url, _req, res, _server, context2) => {
  const components = context2.elements.filter(
    (element) => element.type === "Component" /* Component */
  );
  const content = components.reduce((acc, component) => {
    return acc + renderComponentListItemEntry(component.cls, context2.checker.ng);
  }, "");
  const css = `
      .block { display: block; }
    `;
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content, css));
};

// src/main.ts
var context = {
  program: null,
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
  const anyPattern = /^.*$/;
  const nodeIdPattern = /^[\w-]*$/;
  const routes = [
    { path: [""], handler: handleFile },
    { path: ["file", anyPattern], handler: handleFile },
    { path: ["api", "component"], handler: GET_component_list },
    { path: ["api", "component", anyPattern], handler: GET_component },
    {
      path: ["api", "component", anyPattern, "dependency"],
      handler: GET_component_dependency_list
    },
    {
      path: ["api", "component", anyPattern, "consumer"],
      handler: GET_component_consumer_list
    },
    {
      path: ["api", "component", anyPattern, "dependency", anyPattern],
      handler: GET_component_dependency
    },
    {
      path: ["file", anyPattern, "node", nodeIdPattern],
      handler: handleNodeInFile
    },
    { path: ["modules"], handler: handleModules },
    { path: ["tests"], handler: handleTests },
    { path: ["graph"], handler: handleGraph },
    {
      path: ["component", anyPattern],
      handler: handleComponent
    },
    {
      path: ["migrate-single", anyPattern],
      handler: handleToStandaloneNew
    },
    {
      path: ["components"],
      handler: handleComponents
    },
    { path: ["shutdown", anyPattern], handler: handleShutdown },
    { path: ["static", anyPattern], handler: handleStatic }
  ];
  const server = import_http.default.createServer((req, res) => {
    const url = new URL(`http://localhost:3000${req.url}`);
    const pathnameSegments = url.pathname.substring(1).split("/");
    const matchingRoute = routes.find((route) => {
      if (route.path.length !== pathnameSegments.length) return false;
      for (let idx in pathnameSegments) {
        if (isNil(route.path[idx])) return false;
        if (typeof route.path[idx] === "string" && route.path[idx] !== pathnameSegments[idx]) {
          return false;
        }
        if (route.path[idx] instanceof RegExp && !pathnameSegments[idx].match(route.path[idx])) {
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
    const promiseObj = { resolve(x) {
    }, reject() {
    } };
    const promise = new Promise((resolve3, reject) => {
      promiseObj.resolve = () => resolve3();
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
    }
  };
  server.listen(3e3, () => {
    console.log("Server is listening on http://localhost:3000");
  });
  await shutdownSignal.instance;
  console.log("yeehaa");
  server.close();
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
    analyseClass: if (import_typescript17.default.isClassDeclaration(node)) {
      const ngDecorator = getAngularDecorators(
        typeChecker,
        import_typescript17.default.getDecorators(node) || []
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
