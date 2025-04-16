// import { Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { createProgramOptions } from "./utils/typescript/compiler_host";
import { getProjectTsConfigPaths } from "./utils/project_tsconfig_paths";
import ts from "typescript";
import { getImportSpecifier } from "../utils/typescript/imports";
import { getAngularDecorators } from "./utils/ng_decorators";
import { NgtscProgram } from "@angular/compiler-cli";
// const { createProgram } = import("@angular/compiler-cli");
import { createProgram } from "@angular/compiler-cli";

export function dependencyVisualizer(_options) {
  return async (tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    // const { createProgram } = await import("@angular/compiler-cli");

    for (const tsconfigPath of buildPaths) {
      analyseDependencies({
        tree,
        basePath,
        tsconfigPath,
        // createProgram,
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

  const program = createProgram({
    rootNames,
    host,
    options,
  });
  const typeChecker = program.getTsProgram().getTypeChecker();

  // crawl all files
  const sourceFiles: readonly ts.SourceFile[] = program
    .getTsProgram()
    .getSourceFiles();
  for (const sourceFile of sourceFiles) {
    console.log(findNgModuleClasses(sourceFile, typeChecker));
  }

  const templateTypeChecker = (
    program as NgtscProgram
  ).compiler.getTemplateTypeChecker();
  const modulesToMigrate = new Set<ts.ClassDeclaration>();
  const declarations = new Set<ts.ClassDeclaration>();
  // get components
  // get all components dependencies

  console.log(`We did it! ${!!program}`);
}

/**
 * Finds all modules whose declarations can be migrated.
 **/
function findNgModuleClasses(
  sourceFile: ts.SourceFile,
  typeChecker: ts.TypeChecker,
) {
  const modules: ts.ClassDeclaration[] = [];

  const fileImportsNgModule = getImportSpecifier(
    sourceFile,
    "@angular/core",
    "NgModule",
  );

  if (fileImportsNgModule) {
    sourceFile.forEachChild(function walk(node) {
      if (ts.isClassDeclaration(node)) {
        const ngModuleDecorator = getAngularDecorators(
          typeChecker,
          ts.getDecorators(node) || [],
        ).find((current) => current.name === "NgModule");

        // if (ngModuleDecorator) modules.push(node);
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

/** Extracts the metadata object literal from an Angular decorator. */
function extractMetadataLiteral(
  decorator: ts.Decorator,
): ts.ObjectLiteralExpression | null {
  // `arguments[0]` is the metadata object literal.
  return ts.isCallExpression(decorator.expression) &&
    decorator.expression.arguments.length === 1 &&
    ts.isObjectLiteralExpression(decorator.expression.arguments[0])
    ? decorator.expression.arguments[0]
    : null;
}

/** Finds a property with a specific name in an object literal expression. */
function findLiteralProperty(
  literal: ts.ObjectLiteralExpression,
  name: string,
) {
  return literal.properties.find(
    (prop) =>
      prop.name && ts.isIdentifier(prop.name) && prop.name.text === name,
  );
}

/**
 * Checks whether a node is an `NgModule` metadata element with at least one element.
 * E.g. `declarations: [Foo]` or `declarations: SOME_VAR` would match this description,
 * but not `declarations: []`.
 */
function hasNgModuleMetadataElements(
  node: ts.Node,
): node is ts.PropertyAssignment & { initializer: ts.ArrayLiteralExpression } {
  return (
    ts.isPropertyAssignment(node) &&
    (!ts.isArrayLiteralExpression(node.initializer) ||
      node.initializer.elements.length > 0)
  );
}
