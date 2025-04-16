import ts from "typescript";

/**
 * Checks if a specific class declaration is imported into a given source file.
 *
 * @param classDeclaration The ts.ClassDeclaration node from File A.
 * @param sourceFile The ts.SourceFile node for File B.
 * @param typeChecker The TypeScript TypeChecker instance from the ts.Program.
 * @returns True if the class is imported (named, default, or via namespace)
 *          in sourceFile, false otherwise.
 */
export function isClassImported(data: {
  classDeclaration: ts.ClassDeclaration;
  sourceFile: ts.SourceFile;
  typeChecker: ts.TypeChecker;
}): boolean {
  const { classDeclaration, sourceFile, typeChecker } = data;

  // 1. Get the symbol for the original class declaration in File A
  // Ensure the class has a name identifier
  if (!classDeclaration.name) {
    // Anonymous classes cannot be imported by name
    return false;
  }
  const targetSymbol = typeChecker.getSymbolAtLocation(classDeclaration.name);
  if (!targetSymbol) {
    // Should not happen for a valid ClassDeclaration within a Program,
    // but good practice to check.
    console.warn(
      `Could not get symbol for class: ${classDeclaration.name.text}`,
    );
    return false;
  }

  let isImported = false;

  // 2. Iterate through nodes in File B to find imports
  ts.forEachChild(sourceFile, visitNode);

  function visitNode(node: ts.Node): boolean | void {
    // Optimization: stop searching if already found
    if (isImported) {
      return true; // Stops ts.forEachChild traversal for this branch
    }

    // 3. Check if the node is an import declaration
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;

      if (importClause) {
        // 4a. Check default import: import MyClass from './fileA'
        if (importClause.name) {
          // Get the symbol for the local identifier (e.g., `MyClass`)
          const localSymbol = typeChecker.getSymbolAtLocation(
            importClause.name,
          );
          if (localSymbol) {
            // Resolve it to the original symbol it aliases
            const aliasedSymbol = typeChecker.getAliasedSymbol(localSymbol);
            if (aliasedSymbol === targetSymbol) {
              isImported = true;
              return true; // Stop traversal
            }
          }
        }

        // 4b. Check named imports: import { MyClass } from './fileA'
        // or import { MyClass as Alias } from './fileA'
        if (
          importClause.namedBindings &&
          ts.isNamedImports(importClause.namedBindings)
        ) {
          for (const element of importClause.namedBindings.elements) {
            // element is an ImportSpecifier (e.g., `MyClass` or `MyClass as Alias`)
            // Get symbol for the local name (e.g., `MyClass` or `Alias`)
            const localSymbol = typeChecker.getSymbolAtLocation(element.name);
            if (localSymbol) {
              // Resolve it to the original symbol it aliases
              const aliasedSymbol = typeChecker.getAliasedSymbol(localSymbol);
              if (aliasedSymbol === targetSymbol) {
                isImported = true;
                return true; // Stop traversal
              }
            }
          }
        }

        // 4c. Check namespace import: import * as ns from './fileA'
        if (
          importClause.namedBindings &&
          ts.isNamespaceImport(importClause.namedBindings)
        ) {
          // For namespace imports, check if the *module* being imported
          // actually exports the target symbol.
          const moduleSpecifier = node.moduleSpecifier;
          const moduleSymbol = typeChecker.getSymbolAtLocation(moduleSpecifier);

          if (moduleSymbol) {
            const moduleExports = typeChecker.getExportsOfModule(moduleSymbol);
            if (moduleExports.some((expSymbol) => expSymbol === targetSymbol)) {
              isImported = true;
              return true; // Stop traversal
            }
          }
        }
      }
      // Note: Side-effect imports (import './fileA';) don't import symbols
      // directly, so they won't be caught by this logic if the goal is
      // specifically checking for the *class symbol* being imported.
    }

    // 5. Continue traversal recursively down the AST
    if (!isImported) {
      return ts.forEachChild(node, visitNode);
    }
  }

  return isImported;
}
