import ts from "typescript";

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
