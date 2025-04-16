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
var import_typescript11 = __toESM(require("typescript"));

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
var renderComponentListItemEntry = (declaration, ngChecker) => {
  const href = declaration ? `/component/${encodeURIComponent(getGlobalNodeId(declaration))}` : null;
  return a(
    { href, style: "display: block;" },
    `- ${declaration.name?.escapedText} (${ngChecker.getOwningNgModule(declaration)?.name?.escapedText})`
  );
};
var renderDirectiveListItemEntry = (declaration, ngChecker) => {
  const owningModule = ngChecker.getOwningNgModule(declaration);
  const owningModuleName = owningModule ? owningModule.name?.escapedText ?? "missing moudle name" : "standalone";
  return div(null, `- ${declaration.name?.escapedText} (${owningModuleName})`);
};

// src/routes/file.ts
var import_typescript6 = __toESM(require("typescript"));
var handleFile = (url, _req, res, _server, context) => {
  const fsPathSegment = url.pathname.substring(1);
  const fsPath = url.searchParams.get("path") ?? fsPathSegment;
  const fsTreeNode = !fsPath ? context.source.tree : getAtPath(context.source.tree, fsPath);
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
var handleNodeInFile = (_url, _req, res, _server, context) => {
  const [_0, _fsPath, _2, nodeId] = _url.pathname.substring(1).split("/");
  const fsPath = decodeURIComponent(_fsPath).substring(1);
  console.log("fsPath", fsPath);
  const fsTreeNode = getAtPath(context.source.tree, fsPath);
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
  const symbol = context.checker.ts.getSymbolAtLocation(node);
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
var NgElement = /* @__PURE__ */ ((NgElement2) => {
  NgElement2["Directive"] = "Directive";
  NgElement2["Component"] = "Component";
  NgElement2["NgModule"] = "NgModule";
  NgElement2["Pipe"] = "Pipe";
  return NgElement2;
})(NgElement || {});

// src/angular-tsc.helpers.ts
var import_typescript8 = __toESM(require("typescript"));
function findImportLocation(target, inComponent, importMode, typeChecker) {
  const importLocations = typeChecker.getPotentialImportsFor(
    target,
    inComponent,
    importMode
  );
  let firstSameFileImport = null;
  let firstModuleImport = null;
  for (const location of importLocations) {
    if (location.kind === 1 /* Standalone */) {
      return location;
    }
    if (!location.moduleSpecifier && !firstSameFileImport) {
      firstSameFileImport = location;
    }
    if (location.kind === 0 /* NgModule */ && !firstModuleImport && // ɵ is used for some internal Angular modules that we want to skip over.
    !location.symbolName.startsWith("\u0275")) {
      firstModuleImport = location;
    }
  }
  return firstSameFileImport || firstModuleImport || importLocations[0] || null;
}
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
function getComponentImportExpressions(decl, allDeclarations, typeChecker) {
  const templateDependencies = findTemplateDependencies(decl, typeChecker);
  const usedDependenciesInMigration = new Set(
    templateDependencies.filter((dep) => allDeclarations.has(dep.node))
  );
  const seenImports = /* @__PURE__ */ new Set();
  const resolvedDependencies = [];
  for (const dep of templateDependencies) {
    const importLocation = findImportLocation(
      dep,
      decl,
      usedDependenciesInMigration.has(dep) ? 1 /* ForceDirect */ : 0 /* Normal */,
      typeChecker
    );
    if (importLocation && !seenImports.has(importLocation.symbolName)) {
      seenImports.add(importLocation.symbolName);
      resolvedDependencies.push(importLocation);
    }
  }
  return resolvedDependencies;
}

// src/routes/component.ts
var handleComponent = (_url, _req, res, _server, context) => {
  const [_0, _globalNodeId] = _url.pathname.substring(1).split("/");
  const globalNodeId = decodeURIComponent(_globalNodeId);
  console.log("globalNodeId", globalNodeId);
  const nodeData = getDataFromGlobalNodeId(globalNodeId);
  const fsTreeNode = getAtPath(
    context.source.tree,
    nodeData.fileName.substring(1)
  );
  if (!isSourceFile(fsTreeNode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Path does not point to the file.");
    return;
  }
  const component = context.elements.filter((element) => element.type === "Component" /* Component */).find((component2) => getGlobalNodeId(component2.cls) === globalNodeId);
  if (!component) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Component not found in file.");
    return;
  }
  const declaredIn = context.checker.ng.getOwningNgModule(component.cls);
  const usedDirectives = context.checker.ng.getUsedDirectives(component.cls) ?? [];
  const nameTag = div(null, `Name: ${component.cls.name?.escapedText}`);
  const declaredInTag = div(
    null,
    `Declared in: ${declaredIn ? declaredIn.name?.escapedText : "standalone"}`
  );
  const title = nameTag + declaredInTag;
  const componentsHTML = [
    div(null, "Used components:"),
    ...usedDirectives.filter((directive) => directive.isComponent).map((directive) => {
      const declaration = directive.ref.node;
      return renderComponentListItemEntry(
        declaration,
        context.checker.ng
      );
    }),
    div(null, "Used directives:"),
    ...usedDirectives.filter((directive) => !directive.isComponent).map((directive) => {
      const declaration = directive.ref.node;
      return renderDirectiveListItemEntry(
        declaration,
        context.checker.ng
      );
    }),
    div(null, "Potential imports:"),
    ...getComponentImportExpressions(
      component.cls,
      new Set(context.elements.map((_) => _.cls)),
      context.checker.ng
    ).map((potentialImport) => div(null, potentialImport.symbolName))
  ].join("");
  const html = [title, componentsHTML].join(`<hr>`);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(html));
};

// src/routes/modules.ts
var import_typescript9 = __toESM(require("typescript"));
var handleModules = (_url, _req, res, _server, context) => {
  const ngModules = context.elements.filter((element) => element.type === "NgModule" /* NgModule */).map((module2) => {
    let declarations = [];
    const metadata = module2 && extractMetadataLiteral(module2.decorator.node);
    if (!metadata) return { ...module2, declarations };
    const declarationsNode = findLiteralProperty(metadata, "declarations");
    if (!declarationsNode || !hasNgModuleMetadataElements(declarationsNode))
      return { ...module2, declarations };
    declarations = getAllChildren(declarationsNode.initializer).filter((node) => import_typescript9.default.isIdentifier(node)).map((node) => {
      return {
        name: node,
        class: getClassDeclarationForImportedIdentifier(
          context.checker.ts,
          node
        )
      };
    });
    return { ...module2, declarations };
  });
  const content = ngModules.reduce((acc, ngModule) => {
    const moduleId = getGlobalNodeId(ngModule.cls);
    const name = a(
      { href: `/module/${encodeURIComponent(moduleId)}` },
      ngModule.cls.name?.text ?? "NgModule (name unresolvable)"
    );
    const declarations = ngModule.declarations.filter((declaration) => declaration.class).map(
      (declaration) => declaration.class && renderComponentListItemEntry(declaration.class, context.checker.ng)
    ).join("");
    return acc + name + declarations;
  }, "");
  const css = `
      .block { display: block; }
    `;
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content, css));
};
function findLiteralProperty(literal, name) {
  return literal.properties.find(
    (prop) => prop.name && import_typescript9.default.isIdentifier(prop.name) && prop.name.text === name
  );
}
function hasNgModuleMetadataElements(node) {
  return import_typescript9.default.isPropertyAssignment(node) && (!import_typescript9.default.isArrayLiteralExpression(node.initializer) || node.initializer.elements.length > 0);
}

// src/routes/tests.ts
var import_typescript10 = __toESM(require("typescript"));
var handleTests = (_url, _req, res, _server, context) => {
  const testFiles = context.source.files.filter((file) => {
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

// src/main.ts
function dependencyVisualizer(_options) {
  return async (tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");
    for (const tsconfigPath of buildPaths) {
      analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        createProgram
      });
    }
  };
}
function analyseDependencies(data) {
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
  const context = {
    program,
    source: {
      files: sourceFiles,
      tree: fileTree
    },
    checker: {
      ts: tsChecker,
      ng: ngChecker
    },
    elements
  };
  const anyPattern = /^.*$/;
  const nodeIdPattern = /^[\w-]*$/;
  const routes = [
    { path: [""], handler: handleFile },
    { path: ["file", anyPattern], handler: handleFile },
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
  server.listen(3e3, () => {
    console.log("Server is listening on http://localhost:3000");
  });
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
var ngElements = Object.values(NgElement);
function findNgClasses(sourceFile, typeChecker) {
  const modules = [];
  const fileHasNgElements = ngElements.some(
    (element) => getImportSpecifier(sourceFile, "@angular/core", element)
  );
  if (!fileHasNgElements) return modules;
  sourceFile.forEachChild(function walk(node) {
    analyseClass: if (import_typescript11.default.isClassDeclaration(node)) {
      const ngDecorator = getAngularDecorators(
        typeChecker,
        import_typescript11.default.getDecorators(node) || []
      ).find((current) => ngElements.includes(current.name));
      if (!ngDecorator) break analyseClass;
      const metadata = ngDecorator ? extractMetadataLiteral(ngDecorator.node) : null;
      if (!metadata) break analyseClass;
      modules.push({
        cls: node,
        decorator: ngDecorator,
        type: ngDecorator.name
      });
    }
    node.forEachChild(walk);
  });
  return modules;
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
