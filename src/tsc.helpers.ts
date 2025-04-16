import ts, { SyntaxKind } from "typescript";

export const isSourceFile = (x: unknown): x is ts.SourceFile =>
  x !== null &&
  typeof x === "object" &&
  "kind" in x &&
  x.kind === SyntaxKind.SourceFile;

export const getLocalNodeId = (node: ts.Node): string =>
  `${node.kind}-${node.pos}-${node.end}`;

export const getGlobalNodeId = (node: ts.Node): string =>
  `${node.getSourceFile().fileName}$$${node.kind}$$${node.pos}$$${node.end}`;

export const getDataFromGlobalNodeId = (
  globalNodeId: string,
): {
  fileName: string;
  kind: SyntaxKind;
  pos: number;
  end: number;
} => {
  const [fileName, _kind, _pos, _end] = globalNodeId.split("$$");
  return {
    fileName,
    kind: Number(_kind),
    pos: Number(_pos),
    end: Number(_end),
  };
};

export const getAllChildren = (node: ts.Node): ts.Node[] => {
  const children: ts.Node[] = [];

  node.forEachChild((child) => {
    children.push(child);
  });

  return children;
};

export const getAllChildrenDeep = (node: ts.Node): ts.Node[] => {
  const children: ts.Node[] = [];

  node.forEachChild((child) => {
    children.push(child, ...getAllChildrenDeep(child));
  });

  return children;
};

export const getClassDeclarationForImportedIdentifier = (
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): ts.ClassDeclaration | undefined => {
  const localSymbol = typeChecker.getSymbolAtLocation(node);
  const importSpecifier = localSymbol
    ?.getDeclarations()
    ?.find(ts.isImportSpecifier);
  const importSpecifierNameSymbol =
    importSpecifier?.name &&
    typeChecker.getSymbolAtLocation(importSpecifier?.name);
  const importSpecifierNameAliasedSymbol =
    importSpecifierNameSymbol &&
    typeChecker.getAliasedSymbol(importSpecifierNameSymbol);
  const importSpecifierNameAliasedSymbolDeclarations =
    importSpecifierNameAliasedSymbol &&
    importSpecifierNameAliasedSymbol.getDeclarations();

  return importSpecifierNameAliasedSymbolDeclarations?.find(
    ts.isClassDeclaration,
  );
};

/**
 * Gets a top-level import specifier with a specific name that is imported from a particular module.
 * E.g. given a file that looks like:
 *
 * ```
 * import { Component, Directive } from '@angular/core';
 * import { Foo } from './foo';
 * ```
 *
 * Calling `getImportSpecifier(sourceFile, '@angular/core', 'Directive')` will yield the node
 * referring to `Directive` in the top import.
 *
 * @param sourceFile File in which to look for imports.
 * @param moduleName Name of the import's module.
 * @param specifierName Original name of the specifier to look for. Aliases will be resolved to
 *    their original name.
 */
export function getImportSpecifier(
  sourceFile: ts.SourceFile,
  moduleName: string | RegExp,
  specifierName: string,
): ts.ImportSpecifier | null {
  return (
    getImportSpecifiers(sourceFile, moduleName, [specifierName])[0] ?? null
  );
}

export function getImportSpecifiers(
  sourceFile: ts.SourceFile,
  moduleName: string | RegExp,
  specifierNames: string[],
): ts.ImportSpecifier[] {
  const matches: ts.ImportSpecifier[] = [];
  for (const node of sourceFile.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const isMatch =
        typeof moduleName === "string"
          ? node.moduleSpecifier.text === moduleName
          : moduleName.test(node.moduleSpecifier.text);
      const namedBindings = node.importClause?.namedBindings;
      if (isMatch && namedBindings && ts.isNamedImports(namedBindings)) {
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

/** Finds an import specifier with a particular name. */
export function findImportSpecifier(
  nodes: ts.NodeArray<ts.ImportSpecifier>,
  specifierName: string,
): ts.ImportSpecifier | undefined {
  return nodes.find((element) => {
    const { name, propertyName } = element;
    return propertyName
      ? propertyName.text === specifierName
      : name.text === specifierName;
  });
}

/**
 * Replaces an import inside a named imports node with a different one.
 *
 * @param node Node that contains the imports.
 * @param existingImport Import that should be replaced.
 * @param newImportName Import that should be inserted.
 */
export function replaceImport(
  node: ts.NamedImports,
  existingImport: string,
  newImportName: string,
) {
  const isAlreadyImported = findImportSpecifier(node.elements, newImportName);
  if (isAlreadyImported) {
    return node;
  }

  const existingImportNode = findImportSpecifier(node.elements, existingImport);
  if (!existingImportNode) {
    return node;
  }

  const importPropertyName = existingImportNode.propertyName
    ? ts.factory.createIdentifier(newImportName)
    : undefined;
  const importName = existingImportNode.propertyName
    ? existingImportNode.name
    : ts.factory.createIdentifier(newImportName);

  return ts.factory.updateNamedImports(node, [
    ...node.elements.filter((current) => current !== existingImportNode),
    // Create a new import while trying to preserve the alias of the old one.
    ts.factory.createImportSpecifier(false, importPropertyName, importName),
  ]);
}

/**
 * Removes a symbol from the named imports and updates a node
 * that represents a given named imports.
 *
 * @param node Node that contains the imports.
 * @param symbol Symbol that should be removed.
 * @returns An updated node (ts.NamedImports).
 */
export function removeSymbolFromNamedImports(
  node: ts.NamedImports,
  symbol: ts.ImportSpecifier,
) {
  return ts.factory.updateNamedImports(node, [
    ...node.elements.filter((current) => current !== symbol),
  ]);
}

/** Extracts the metadata object literal from an Angular decorator. */
export function extractMetadataLiteral(
  decorator: ts.Decorator,
): ts.ObjectLiteralExpression | null {
  // `arguments[0]` is the metadata object literal.
  return ts.isCallExpression(decorator.expression) &&
    decorator.expression.arguments.length === 1 &&
    ts.isObjectLiteralExpression(decorator.expression.arguments[0])
    ? decorator.expression.arguments[0]
    : null;
}
