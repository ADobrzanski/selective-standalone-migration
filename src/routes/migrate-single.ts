/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  type PotentialImport,
  type PotentialImportMode,
  type Reference,
  type TemplateTypeChecker,
} from "@angular/compiler-cli/private/migrations";
import ts from "typescript";
import { XMLParser } from "fast-xml-parser";

import { ChangeTracker, ImportRemapper } from "../../utils/change_tracker";
import { getAngularDecorators, NgDecorator } from "../../utils/ng_decorators";
import { closestNode } from "../../utils/typescript/nodes";
import { IncomingMessage, ServerResponse, Server } from "http";
import { ScriptContext, context } from "../main";
import {
  getDataFromGlobalNodeId,
  getGlobalNodeId,
  isSourceFile,
} from "../tsc.helpers";
import { getAtPath } from "../helpers";
import { NgElementType } from "../types/ng-element.enum";
import { NamedClassDeclaration } from "../angular-tsc.helpers";
import { relative, dirname } from "path";
import * as fs from "fs";
import { isClassImported } from "./migrate-single/utils";

/**
 * Function that can be used to prcess the dependencies that
 * are going to be added to the imports of a declaration.
 */
export type DeclarationImportsRemapper = (
  imports: PotentialImport[],
) => PotentialImport[];

export const handleToStandaloneNew = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const [_0, _elementId] = _url.pathname.substring(1).split("/");
  const component = context.elements.at(Number(_elementId));
  const printer = ts.createPrinter();

  if (!component) return;

  const migrationIssues = findMigrationBlockers({
    classDeclaration: component.cls,
    templateTypeChecker: context.checker.ng,
  });
  if (migrationIssues) {
    res.writeHead(409, { "Content-Type": "text/json" });
    res.end(JSON.stringify(migrationIssues));
    return;
  }

  console.log("about to migrate");
  toStandalone(component.cls, context, printer);

  context.server.shut();

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Yeehaa");
};

function findMigrationBlockers(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
}) {
  const { classDeclaration, templateTypeChecker } = data;

  const owningModule = templateTypeChecker.getOwningNgModule(classDeclaration)!;
  const selector =
    templateTypeChecker.getDirectiveMetadata(classDeclaration)?.selector;

  if (!selector)
    throw Error(
      "Cannot check templates for usage if component has no selector.",
    );

  const sameModuleConsumers = context.elements.filter((potentialConsumer) => {
    // only components have templates
    if (potentialConsumer.type !== NgElementType.Component) return false;

    const potentialConsumerOwningModule = templateTypeChecker.getOwningNgModule(
      potentialConsumer.cls,
    );
    // disregard standalone components
    if (!potentialConsumerOwningModule) return false;
    // disregard components declared in other modules
    if (owningModule !== potentialConsumerOwningModule) return false;

    const template = getTemplateOrNull(potentialConsumer.decorator.node);
    if (!template) return false;

    // check if template includes tag matching component's selector
    // WARNING: naive method, will not handle complex selectors
    return getAllXmlTags(template).includes(selector);
  });

  if (sameModuleConsumers.length === 0) {
    return null;
  }

  const sameModuleDependencies =
    context.elements
      .find((_) => _.cls === classDeclaration)
      ?.dependencies()
      .filter(
        (_) => templateTypeChecker.getOwningNgModule(_.node) === owningModule,
      ) ?? [];

  if (sameModuleDependencies.length === 0) {
    return null;
  }

  const componentName = classDeclaration.name?.text;
  const owningModuleName = owningModule.name?.text;

  return {
    error: "Migration would result in circular dependecy.",
    details:
      `${componentName} is currently declared in ${owningModuleName}.` +
      ` There are ${sameModuleConsumers.length} component(s) declared in that module depending on ${componentName}.` +
      ` There are also ${sameModuleDependencies.length} dependencies declared in that module ${componentName} uses.` +
      ` Migrating ${componentName} would result in circular dependecy. Migrate either said consumers or dependencies first to prevent this issue.`,
    consumers: sameModuleConsumers.map((_) => _.cls.name?.text),
    dependencies: sameModuleDependencies.map((_) => _.node.name.text),
  };
}

export const handleToStandalone = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const [_0, _globalNodeId] = _url.pathname.substring(1).split("/");
  const globalNodeId = decodeURIComponent(_globalNodeId);
  console.log("globalNodeId", globalNodeId);
  const nodeData = getDataFromGlobalNodeId(globalNodeId);
  const fsTreeNode = getAtPath(
    context.source.tree,
    nodeData.fileName.substring(1),
  );

  if (!isSourceFile(fsTreeNode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Path does not point to the file.");
    return;
  }

  const component = context.elements
    .filter((element) => element.type === NgElementType.Component)
    .find((component) => getGlobalNodeId(component.cls) === globalNodeId);

  if (!component) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Component not found in file.");
    return;
  }

  const printer = ts.createPrinter();
  toStandalone(component.cls, context, printer);

  context.server.shut();

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Yeehaa");
};

/**
 * Converts all declarations in the specified files to standalone.
 * @param program
 * @param printer
 * @param fileImportRemapper Optional function that can be used to remap file-level imports.
 * @param declarationImportRemapper Optional function that can be used to remap declaration-level
 * imports.
 */
export function toStandalone(
  // sourceFiles: ts.SourceFile[],
  toMigrate: ts.ClassDeclaration,
  // program: NgtscProgram,
  context: ScriptContext,
  printer: ts.Printer,
  fileImportRemapper?: ImportRemapper,
  declarationImportRemapper?: DeclarationImportsRemapper,
): void {
  const { program } = context;
  const tree = context.schematic.tree;
  const templateTypeChecker = program.compiler.getTemplateTypeChecker();
  const typeChecker = program.getTsProgram().getTypeChecker();
  // const modulesToMigrate = new Set<ts.ClassDeclaration>();
  // const testObjectsToMigrate = new Set<ts.ObjectLiteralExpression>();
  const declarations = new Set<ts.ClassDeclaration>();
  const tracker = new ChangeTracker(printer, fileImportRemapper);

  // for (const sourceFile of sourceFiles) {
  // const modules = findNgModuleClassesToMigrate(sourceFile, typeChecker);
  // const testObjects = findTestObjectsToMigrate(sourceFile, typeChecker);

  //   for (const module of modules) {
  //     const allModuleDeclarations = extractDeclarationsFromModule(module, templateTypeChecker);
  //     const unbootstrappedDeclarations = filterNonBootstrappedDeclarations(
  //       allModuleDeclarations,
  //       module,
  //       templateTypeChecker,
  //       typeChecker,
  //     );
  //
  //     if (unbootstrappedDeclarations.length > 0) {
  //       modulesToMigrate.add(module);
  //       unbootstrappedDeclarations.forEach((decl) => declarations.add(decl));
  //     }
  //   }
  //
  //   testObjects.forEach((obj) => testObjectsToMigrate.add(obj));
  // }

  // for (const declaration of declarations) {
  convertNgModuleDeclarationToStandalone(
    toMigrate,
    declarations,
    tracker,
    templateTypeChecker,
    declarationImportRemapper,
  );
  // }

  importNewStandaloneInConsumers({ toMigrate, tracker });

  // for (const node of modulesToMigrate) {
  //   migrateNgModuleClass(node, declarations, tracker, typeChecker, templateTypeChecker);
  // }
  //
  // migrateTestDeclarations(
  //   testObjectsToMigrate,
  //   declarations,
  //   tracker,
  //   templateTypeChecker,
  //   typeChecker,
  // );
  const pendingChanges = tracker.recordChanges();

  // console.log(pendingChanges);

  for (const [file, changes] of pendingChanges.entries()) {
    const update = tree.beginUpdate(relative(process.cwd(), file.fileName));

    changes.forEach((change) => {
      if (change.removeLength != null) {
        update.remove(change.start, change.removeLength);
      }
      update.insertRight(change.start, change.text);
    });

    tree.commitUpdate(update);
  }
}

/**
 * Converts a single declaration defined through an NgModule to standalone:
 * - adds "standalone: true" to the decorator
 * - adds "imports" to the decorator
 * @param decl Declaration being converted.
 * @param tracker Tracker used to track the file changes.
 * @param soonToBeStandalone All the declarations that are being converted as a part of this migration.
 * @param typeChecker
 * @param importRemapper
 */
function convertNgModuleDeclarationToStandalone(
  decl: ts.ClassDeclaration,
  soonToBeStandalone: Set<ts.ClassDeclaration>,
  tracker: ChangeTracker,
  typeChecker: TemplateTypeChecker,
  importRemapper?: DeclarationImportsRemapper,
): void {
  const directiveMeta = typeChecker.getDirectiveMetadata(decl);

  if (directiveMeta && directiveMeta.decorator && !directiveMeta.isStandalone) {
    let decorator = markDecoratorAsStandalone(directiveMeta.decorator);

    if (directiveMeta.isComponent) {
      const importsToAdd = getComponentImportExpressions(
        decl,
        soonToBeStandalone,
        tracker,
        typeChecker,
        importRemapper,
      );

      if (importsToAdd.length > 0) {
        const hasTrailingComma =
          importsToAdd.length > 2 &&
          !!extractMetadataLiteral(directiveMeta.decorator)?.properties
            .hasTrailingComma;
        decorator = setPropertyOnAngularDecorator(
          decorator,
          "imports",
          ts.factory.createArrayLiteralExpression(
            // Create a multi-line array when it has a trailing comma.
            ts.factory.createNodeArray(importsToAdd, hasTrailingComma),
            hasTrailingComma,
          ),
        );
      }
    }

    tracker.replaceNode(directiveMeta.decorator, decorator);
  } else {
    const pipeMeta = typeChecker.getPipeMetadata(decl);

    if (pipeMeta && pipeMeta.decorator && !pipeMeta.isStandalone) {
      tracker.replaceNode(
        pipeMeta.decorator,
        markDecoratorAsStandalone(pipeMeta.decorator),
      );
    }
  }
}

/**
 * Finds all places migrated dependency is being used and updates the imports.
 * @param decl Declaration being converted.
 * @param tracker Tracker used to track the file changes.
 * @param typeChecker
 * @param importRemapper
 */
function importNewStandaloneInConsumers(data: {
  toMigrate: ts.ClassDeclaration;
  tracker: ChangeTracker;
  importRemapper?: DeclarationImportsRemapper;
}): void {
  const { toMigrate: decl, tracker } = data;
  const toMigrateMeta = context.checker.ng.getDirectiveMetadata(decl);
  if (!toMigrateMeta) return;

  const selectorToMigrate = toMigrateMeta.selector;
  if (!selectorToMigrate) return;

  const directConsumers = context.elements
    .filter((el) => {
      if (el.type !== NgElementType.Component) return false;
      console.log("checking", el.cls.name?.getText());

      const template = getTemplateOrNull(el.decorator.node);
      if (!template) return null;

      // naive method, will not handle complex selectors
      const tags = getAllXmlTags(template);
      const hit = tags.includes(selectorToMigrate);

      if (hit) console.log("HIT!");
      return hit;
    })
    .map((consumer) => ({
      ...consumer,
      owningModule: context.checker.ng.getOwningNgModule(consumer.cls),
    }));

  const modulesToUpdate = [
    ...new Set(directConsumers.map((_) => _.owningModule)),
  ].filter(Boolean);
  const standaloneToUpdate = directConsumers
    .filter((_) => !_.owningModule)
    .map((_) => _.cls);
  const toUpdate = [...modulesToUpdate, ...standaloneToUpdate];

  for (let importTarget of toUpdate) {
    if (!importTarget || !decl.name?.text) continue;

    // if the file does not already import class
    if (
      !isClassImported({
        classDeclaration: decl,
        sourceFile: importTarget.getSourceFile(),
        typeChecker: context.checker.ts,
      })
    ) {
      // add import (using project-scoped absolute path)
      tracker.addImport(
        importTarget.getSourceFile(),
        decl.name.text,
        // drop '.ts' extension from final import path
        relative(context.basePath, decl.getSourceFile().fileName).slice(0, -3),
      );
    }

    // reference class inside `imports` of module or standalone component
    addImportToModuleLike({ import: decl, to: importTarget, tracker });
  }
}

function getTemplateOrNull(decorator: ts.Decorator): string | null {
  const templateUrl = getTemplateUrlOrNull(decorator);
  const componentDirectory = dirname(decorator.getSourceFile().fileName);

  if (!templateUrl) return null;

  const relativeTemplateUrl = relative(
    process.cwd(),
    `${componentDirectory}/${templateUrl}`,
  );

  return readFileAsString(relativeTemplateUrl);
}

function getTemplateUrlOrNull(decorator: ts.Decorator): string | null {
  const metadata = extractMetadataLiteral(decorator);
  if (!metadata) return null;

  const templateUrlLiteral = findLiteralProperty(metadata, "templateUrl");
  if (!templateUrlLiteral) return null;
  if (!ts.isPropertyAssignment(templateUrlLiteral)) return null;

  let relativeTemplateUrl = templateUrlLiteral.initializer.getText();
  if (!relativeTemplateUrl) return null;

  // we assume `getText()` returns the path wrapped in "/'/` (eg. `"./some.component.html"`)
  // so we unwrap it
  return relativeTemplateUrl.slice(1, -1);
}

function getAllXmlTags(xmlString: string): string[] {
  const parser = new XMLParser();
  try {
    const xmlDoc = parser.parse(xmlString);
    const tagNames: string[] = [];

    function traverse(obj: any) {
      if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            tagNames.push(key);
            traverse(obj[key]);
          }
        }
      }
    }

    traverse(xmlDoc);
    return [...new Set(tagNames)]; // Remove duplicates
  } catch (error) {
    console.error("XML Parsing Error:", error);
    return [];
  }
}

function readFileAsString(absolutePath: fs.PathOrFileDescriptor) {
  try {
    const data = fs.readFileSync(absolutePath, "utf8");
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

/**
 * Gets the expressions that should be added to a component's
 * `imports` array based on its template dependencies.
 * @param decl Component class declaration.
 * @param soonToBeStandalone All the declarations that are being converted as a part of this migration.
 * @param tracker
 * @param typeChecker
 * @param importRemapper
 */
function getComponentImportExpressions(
  decl: ts.ClassDeclaration,
  soonToBeStandalone: Set<ts.ClassDeclaration>,
  tracker: ChangeTracker,
  typeChecker: TemplateTypeChecker,
  importRemapper?: DeclarationImportsRemapper,
): ts.Expression[] {
  const templateDependencies = findTemplateDependencies(decl, typeChecker);
  const templateDependenciesSoonStandalone = new Set(
    templateDependencies.filter((dep) => soonToBeStandalone.has(dep.node)),
  );
  const seenImports = new Set<string>();
  const resolvedDependencies: PotentialImport[] = [];

  for (const dep of templateDependencies) {
    const importLocation = findImportLocation(
      dep as Reference<NamedClassDeclaration>,
      decl,
      templateDependenciesSoonStandalone.has(dep) ? 1 : 0,
      // ? PotentialImportMode.ForceDirect
      // : PotentialImportMode.Normal,
      typeChecker,
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
    importRemapper,
  );
}

/**
 * Converts an array of potential imports to an array of expressions that can be
 * added to the `imports` array.
 * @param potentialImports Imports to be converted.
 * @param component Component class to which the imports will be added.
 * @param tracker
 * @param importRemapper
 */
export function potentialImportsToExpressions(
  potentialImports: PotentialImport[],
  toFile: ts.SourceFile,
  tracker: ChangeTracker,
  importRemapper?: DeclarationImportsRemapper,
): ts.Expression[] {
  const processedDependencies = importRemapper
    ? importRemapper(potentialImports)
    : potentialImports;

  return processedDependencies.map((importLocation) => {
    if (importLocation.moduleSpecifier) {
      return tracker.addImport(
        toFile,
        importLocation.symbolName,
        importLocation.moduleSpecifier,
      );
    }

    const identifier = ts.factory.createIdentifier(importLocation.symbolName);
    if (!importLocation.isForwardReference) {
      return identifier;
    }

    const forwardRefExpression = tracker.addImport(
      toFile,
      "forwardRef",
      "@angular/core",
    );
    const arrowFunction = ts.factory.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      identifier,
    );

    return ts.factory.createCallExpression(forwardRefExpression, undefined, [
      arrowFunction,
    ]);
  });
}

///**
// * Moves all of the declarations of a class decorated with `@NgModule` to its imports.
// * @param node Class being migrated.
// * @param allDeclarations All the declarations that are being converted as a part of this migration.
// * @param tracker
// * @param typeChecker
// * @param templateTypeChecker
// */
//function migrateNgModuleClass(
//  node: ts.ClassDeclaration,
//  allDeclarations: Set<ts.ClassDeclaration>,
//  tracker: ChangeTracker,
//  typeChecker: ts.TypeChecker,
//  templateTypeChecker: TemplateTypeChecker,
//) {
//  const decorator = templateTypeChecker.getNgModuleMetadata(node)?.decorator;
//  const metadata = decorator ? extractMetadataLiteral(decorator) : null;
//
//  if (metadata) {
//    moveDeclarationsToImports(
//      metadata,
//      allDeclarations,
//      typeChecker,
//      templateTypeChecker,
//      tracker,
//    );
//  }
//}

///**
// * Moves all the symbol references from the `declarations` array to the `imports`
// * array of an `NgModule` class and removes the `declarations`.
// * @param literal Object literal used to configure the module that should be migrated.
// * @param allDeclarations All the declarations that are being converted as a part of this migration.
// * @param typeChecker
// * @param tracker
// */
//function moveDeclarationsToImports(
//  literal: ts.ObjectLiteralExpression,
//  allDeclarations: Set<ts.ClassDeclaration>,
//  typeChecker: ts.TypeChecker,
//  templateTypeChecker: TemplateTypeChecker,
//  tracker: ChangeTracker,
//): void {
//  const declarationsProp = findLiteralProperty(literal, "declarations");
//
//  if (!declarationsProp) {
//    return;
//  }
//
//  const declarationsToPreserve: ts.Expression[] = [];
//  const declarationsToCopy: ts.Expression[] = [];
//  const properties: ts.ObjectLiteralElementLike[] = [];
//  const importsProp = findLiteralProperty(literal, "imports");
//  const hasAnyArrayTrailingComma = literal.properties.some(
//    (prop) =>
//      ts.isPropertyAssignment(prop) &&
//      ts.isArrayLiteralExpression(prop.initializer) &&
//      prop.initializer.elements.hasTrailingComma,
//  );
//
//  // Separate the declarations that we want to keep and ones we need to copy into the `imports`.
//  if (ts.isPropertyAssignment(declarationsProp)) {
//    // If the declarations are an array, we can analyze it to
//    // find any classes from the current migration.
//    if (ts.isArrayLiteralExpression(declarationsProp.initializer)) {
//      for (const el of declarationsProp.initializer.elements) {
//        if (ts.isIdentifier(el)) {
//          const correspondingClass = findClassDeclaration(el, typeChecker);
//
//          if (
//            !correspondingClass ||
//            // Check whether the declaration is either standalone already or is being converted
//            // in this migration. We need to check if it's standalone already, in order to correct
//            // some cases where the main app and the test files are being migrated in separate
//            // programs.
//            isStandaloneDeclaration(
//              correspondingClass,
//              allDeclarations,
//              templateTypeChecker,
//            )
//          ) {
//            declarationsToCopy.push(el);
//          } else {
//            declarationsToPreserve.push(el);
//          }
//        } else {
//          declarationsToCopy.push(el);
//        }
//      }
//    } else {
//      // Otherwise create a spread that will be copied into the `imports`.
//      declarationsToCopy.push(
//        ts.factory.createSpreadElement(declarationsProp.initializer),
//      );
//    }
//  }
//
//  // If there are no `imports`, create them with the declarations we want to copy.
//  if (!importsProp && declarationsToCopy.length > 0) {
//    properties.push(
//      ts.factory.createPropertyAssignment(
//        "imports",
//        ts.factory.createArrayLiteralExpression(
//          ts.factory.createNodeArray(
//            declarationsToCopy,
//            hasAnyArrayTrailingComma && declarationsToCopy.length > 2,
//          ),
//        ),
//      ),
//    );
//  }
//
//  for (const prop of literal.properties) {
//    if (!isNamedPropertyAssignment(prop)) {
//      properties.push(prop);
//      continue;
//    }
//
//    // If we have declarations to preserve, update the existing property, otherwise drop it.
//    if (prop === declarationsProp) {
//      if (declarationsToPreserve.length > 0) {
//        const hasTrailingComma = ts.isArrayLiteralExpression(prop.initializer)
//          ? prop.initializer.elements.hasTrailingComma
//          : hasAnyArrayTrailingComma;
//        properties.push(
//          ts.factory.updatePropertyAssignment(
//            prop,
//            prop.name,
//            ts.factory.createArrayLiteralExpression(
//              ts.factory.createNodeArray(
//                declarationsToPreserve,
//                hasTrailingComma && declarationsToPreserve.length > 2,
//              ),
//            ),
//          ),
//        );
//      }
//      continue;
//    }
//
//    // If we have an `imports` array and declarations
//    // that should be copied, we merge the two arrays.
//    if (prop === importsProp && declarationsToCopy.length > 0) {
//      let initializer: ts.Expression;
//
//      if (ts.isArrayLiteralExpression(prop.initializer)) {
//        initializer = ts.factory.updateArrayLiteralExpression(
//          prop.initializer,
//          ts.factory.createNodeArray(
//            [...prop.initializer.elements, ...declarationsToCopy],
//            prop.initializer.elements.hasTrailingComma,
//          ),
//        );
//      } else {
//        initializer = ts.factory.createArrayLiteralExpression(
//          ts.factory.createNodeArray(
//            [
//              ts.factory.createSpreadElement(prop.initializer),
//              ...declarationsToCopy,
//            ],
//            // Expect the declarations to be greater than 1 since
//            // we have the pre-existing initializer already.
//            hasAnyArrayTrailingComma && declarationsToCopy.length > 1,
//          ),
//        );
//      }
//
//      properties.push(
//        ts.factory.updatePropertyAssignment(prop, prop.name, initializer),
//      );
//      continue;
//    }
//
//    // Retain any remaining properties.
//    properties.push(prop);
//  }
//
//  tracker.replaceNode(
//    literal,
//    ts.factory.updateObjectLiteralExpression(
//      literal,
//      ts.factory.createNodeArray(
//        properties,
//        literal.properties.hasTrailingComma,
//      ),
//    ),
//    ts.EmitHint.Expression,
//  );
//}

/**
 * Moves all the symbol references from the `declarations` array to the `imports`
 * array of an `NgModule` class and removes the `declarations`.
 * @param literal Object literal used to configure the module that should be migrated.
 * @param typeChecker
 * @param tracker
 */
function addImportToModuleLike(data: {
  import: ts.ClassDeclaration;
  to: ts.ClassDeclaration;
  tracker: ChangeTracker;
}): void {
  if (!data.import.name)
    throw new Error("Class to be imported has no name (?)");

  const decorator = context.checker.ng.getPrimaryAngularDecorator(data.to);
  if (!decorator)
    throw new Error(`${data.to.name?.text} has no angular decorator.`);

  const meta = extractMetadataLiteral(decorator);
  if (!meta)
    throw new Error(`${data.to.name?.text} decorator has no arguments.`);

  const importsProperty = findLiteralProperty(meta, "imports");
  const hasAnyArrayTrailingComma = meta.properties.some(
    (prop) =>
      ts.isPropertyAssignment(prop) &&
      ts.isArrayLiteralExpression(prop.initializer) &&
      prop.initializer.elements.hasTrailingComma,
  );

  const newImport = ts.factory.createIdentifier(data.import.name.text);

  const properties: ts.ObjectLiteralElementLike[] = [];

  for (const prop of meta.properties) {
    if (!isNamedPropertyAssignment(prop)) {
      properties.push(prop);
      continue;
    }

    // If we have an `imports` array and declarations
    // that should be copied, we merge the two arrays.
    if (prop === importsProperty) {
      let initializer: ts.Expression;

      if (ts.isArrayLiteralExpression(prop.initializer)) {
        initializer = ts.factory.updateArrayLiteralExpression(
          prop.initializer,
          ts.factory.createNodeArray(
            [...prop.initializer.elements, newImport],
            prop.initializer.elements.hasTrailingComma,
          ),
        );
      } else {
        initializer = ts.factory.createArrayLiteralExpression(
          ts.factory.createNodeArray(
            [ts.factory.createSpreadElement(prop.initializer), newImport],
            // Expect the declarations to be greater than 1 since
            // we have the pre-existing initializer already.
            hasAnyArrayTrailingComma,
          ),
        );
      }

      properties.push(
        ts.factory.updatePropertyAssignment(prop, prop.name, initializer),
      );
      continue;
    }

    // Retain any remaining properties.
    properties.push(prop);
  }

  data.tracker.replaceNode(
    meta,
    ts.factory.updateObjectLiteralExpression(
      meta,
      ts.factory.createNodeArray(properties, meta.properties.hasTrailingComma),
    ),
    ts.EmitHint.Expression,
  );
}

/** Sets a decorator node to be standalone. */
function markDecoratorAsStandalone(node: ts.Decorator): ts.Decorator {
  const metadata = extractMetadataLiteral(node);

  if (metadata === null || !ts.isCallExpression(node.expression)) {
    return node;
  }

  const standaloneProp = metadata.properties.find((prop) => {
    return isNamedPropertyAssignment(prop) && prop.name.text === "standalone";
  }) as ts.PropertyAssignment | undefined;

  // In v19 standalone is the default so don't do anything if there's no `standalone`
  // property or it's initialized to anything other than `false`.
  if (
    !standaloneProp ||
    standaloneProp.initializer.kind !== ts.SyntaxKind.FalseKeyword
  ) {
    return node;
  }

  const newProperties = metadata.properties.filter(
    (element) => element !== standaloneProp,
  );

  // Use `createDecorator` instead of `updateDecorator`, because
  // the latter ends up duplicating the node's leading comment.
  return ts.factory.createDecorator(
    ts.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        ts.factory.createObjectLiteralExpression(
          ts.factory.createNodeArray(
            newProperties,
            metadata.properties.hasTrailingComma,
          ),
          newProperties.length > 1,
        ),
      ],
    ),
  );
}

/**
 * Sets a property on an Angular decorator node. If the property
 * already exists, its initializer will be replaced.
 * @param node Decorator to which to add the property.
 * @param name Name of the property to be added.
 * @param initializer Initializer for the new property.
 */
function setPropertyOnAngularDecorator(
  node: ts.Decorator,
  name: string,
  initializer: ts.Expression,
): ts.Decorator {
  // Invalid decorator.
  if (
    !ts.isCallExpression(node.expression) ||
    node.expression.arguments.length > 1
  ) {
    return node;
  }

  let literalProperties: ts.ObjectLiteralElementLike[];
  let hasTrailingComma = false;

  if (node.expression.arguments.length === 0) {
    literalProperties = [
      ts.factory.createPropertyAssignment(name, initializer),
    ];
  } else if (ts.isObjectLiteralExpression(node.expression.arguments[0])) {
    const literal = node.expression.arguments[0];
    const existingProperty = findLiteralProperty(literal, name);
    hasTrailingComma = literal.properties.hasTrailingComma;

    if (existingProperty && ts.isPropertyAssignment(existingProperty)) {
      literalProperties = literal.properties.slice();
      literalProperties[literalProperties.indexOf(existingProperty)] =
        ts.factory.updatePropertyAssignment(
          existingProperty,
          existingProperty.name,
          initializer,
        );
    } else {
      literalProperties = [
        ...literal.properties,
        ts.factory.createPropertyAssignment(name, initializer),
      ];
    }
  } else {
    // Unsupported case (e.g. `@Component(SOME_CONST)`). Return the original node.
    return node;
  }

  // Use `createDecorator` instead of `updateDecorator`, because
  // the latter ends up duplicating the node's leading comment.
  return ts.factory.createDecorator(
    ts.factory.createCallExpression(
      node.expression.expression,
      node.expression.typeArguments,
      [
        ts.factory.createObjectLiteralExpression(
          ts.factory.createNodeArray(literalProperties, hasTrailingComma),
          literalProperties.length > 1,
        ),
      ],
    ),
  );
}

/** Checks if a node is a `PropertyAssignment` with a name. */
function isNamedPropertyAssignment(
  node: ts.Node,
): node is ts.PropertyAssignment & { name: ts.Identifier } {
  return (
    ts.isPropertyAssignment(node) && node.name && ts.isIdentifier(node.name)
  );
}

/**
 * Finds the import from which to bring in a template dependency of a component.
 * @param target Dependency that we're searching for.
 * @param inContext Component in which the dependency is used.
 * @param importMode Mode in which to resolve the import target.
 * @param typeChecker
 */
export function findImportLocation(
  target: Reference<NamedClassDeclaration>,
  inContext: ts.Node,
  importMode: PotentialImportMode,
  typeChecker: TemplateTypeChecker,
): PotentialImport | null {
  const importLocations = typeChecker.getPotentialImportsFor(
    target,
    inContext as any,
    importMode,
  );
  let firstSameFileImport: PotentialImport | null = null;
  let firstModuleImport: PotentialImport | null = null;

  for (const location of importLocations) {
    // Prefer a standalone import, if we can find one.
    // Otherwise fall back to the first module-based import.
    // if (location.kind === PotentialImportKind.Standalone) {
    if (location.kind === 1) {
      return location;
    }
    if (!location.moduleSpecifier && !firstSameFileImport) {
      firstSameFileImport = location;
    }
    if (
      // location.kind === PotentialImportKind.NgModule &&
      location.kind === 0 &&
      !firstModuleImport &&
      // ɵ is used for some internal Angular modules that we want to skip over.
      !location.symbolName.startsWith("ɵ")
    ) {
      firstModuleImport = location;
    }
  }

  return firstSameFileImport || firstModuleImport || importLocations[0] || null;
}

/**
 * Checks whether a node is an `NgModule` metadata element with at least one element.
 * E.g. `declarations: [Foo]` or `declarations: SOME_VAR` would match this description,
 * but not `declarations: []`.
 */
function hasNgModuleMetadataElements(
  node: ts.Node,
): node is ts.PropertyAssignment {
  return (
    ts.isPropertyAssignment(node) &&
    (!ts.isArrayLiteralExpression(node.initializer) ||
      node.initializer.elements.length > 0)
  );
}

///** Finds all modules whose declarations can be migrated. */
//function findNgModuleClassesToMigrate(
//  sourceFile: ts.SourceFile,
//  typeChecker: ts.TypeChecker,
//) {
//  const modules: ts.ClassDeclaration[] = [];
//
//  if (getImportSpecifier(sourceFile, "@angular/core", "NgModule")) {
//    sourceFile.forEachChild(function walk(node) {
//      if (ts.isClassDeclaration(node)) {
//        const decorator = getAngularDecorators(
//          typeChecker,
//          ts.getDecorators(node) || [],
//        ).find((current) => current.name === "NgModule");
//        const metadata = decorator
//          ? extractMetadataLiteral(decorator.node)
//          : null;
//
//        if (metadata) {
//          const declarations = findLiteralProperty(metadata, "declarations");
//
//          if (
//            declarations != null &&
//            hasNgModuleMetadataElements(declarations)
//          ) {
//            modules.push(node);
//          }
//        }
//      }
//
//      node.forEachChild(walk);
//    });
//  }
//
//  return modules;
//}

///** Finds all testing object literals that need to be migrated. */
//function findTestObjectsToMigrate(
//  sourceFile: ts.SourceFile,
//  typeChecker: ts.TypeChecker,
//) {
//  const testObjects: ts.ObjectLiteralExpression[] = [];
//  const { testBed, catalyst } = getTestingImports(sourceFile);
//
//  if (testBed || catalyst) {
//    sourceFile.forEachChild(function walk(node) {
//      if (isTestCall(typeChecker, node, testBed, catalyst)) {
//        const config = node.arguments[0];
//        const declarations = findLiteralProperty(config, "declarations");
//        if (
//          declarations &&
//          ts.isPropertyAssignment(declarations) &&
//          ts.isArrayLiteralExpression(declarations.initializer) &&
//          declarations.initializer.elements.length > 0
//        ) {
//          testObjects.push(config);
//        }
//      }
//
//      node.forEachChild(walk);
//    });
//  }
//
//  return testObjects;
//}

/**
 * Finds the classes corresponding to dependencies used in a component's template.
 * @param decl Component in whose template we're looking for dependencies.
 * @param typeChecker
 */
export function findTemplateDependencies(
  decl: ts.ClassDeclaration,
  typeChecker: TemplateTypeChecker,
): Reference<NamedClassDeclaration>[] {
  const results: Reference<NamedClassDeclaration>[] = [];
  const usedDirectives = typeChecker.getUsedDirectives(decl);
  const usedPipes = typeChecker.getUsedPipes(decl);

  if (usedDirectives !== null) {
    for (const dir of usedDirectives) {
      if (ts.isClassDeclaration(dir.ref.node)) {
        results.push(dir.ref as Reference<NamedClassDeclaration>);
      }
    }
  }

  if (usedPipes !== null) {
    const potentialPipes = typeChecker.getPotentialPipes(decl);

    for (const pipe of potentialPipes) {
      if (
        ts.isClassDeclaration(pipe.ref.node) &&
        usedPipes.some((current) => pipe.name === current)
      ) {
        results.push(pipe.ref as Reference<NamedClassDeclaration>);
      }
    }
  }

  return results;
}

/**
 * Removes any declarations that are a part of a module's `bootstrap`
 * array from an array of declarations.
 * @param declarations Anaalyzed declarations of the module.
 * @param ngModule Module whote declarations are being filtered.
 * @param templateTypeChecker
 * @param typeChecker
 */
function filterNonBootstrappedDeclarations(
  declarations: ts.ClassDeclaration[],
  ngModule: ts.ClassDeclaration,
  templateTypeChecker: TemplateTypeChecker,
  typeChecker: ts.TypeChecker,
) {
  const metadata = templateTypeChecker.getNgModuleMetadata(ngModule);
  const metaLiteral =
    metadata && metadata.decorator
      ? extractMetadataLiteral(metadata.decorator)
      : null;
  const bootstrapProp = metaLiteral
    ? findLiteralProperty(metaLiteral, "bootstrap")
    : null;

  // If there's no `bootstrap`, we can't filter.
  if (!bootstrapProp) {
    return declarations;
  }

  // If we can't analyze the `bootstrap` property, we can't safely determine which
  // declarations aren't bootstrapped so we assume that all of them are.
  if (
    !ts.isPropertyAssignment(bootstrapProp) ||
    !ts.isArrayLiteralExpression(bootstrapProp.initializer)
  ) {
    return [];
  }

  const bootstrappedClasses = new Set<ts.ClassDeclaration>();

  for (const el of bootstrapProp.initializer.elements) {
    const referencedClass = ts.isIdentifier(el)
      ? findClassDeclaration(el, typeChecker)
      : null;

    // If we can resolve an element to a class, we can filter it out,
    // otherwise assume that the array isn't static.
    if (referencedClass) {
      bootstrappedClasses.add(referencedClass);
    } else {
      return [];
    }
  }

  return declarations.filter((ref) => !bootstrappedClasses.has(ref));
}

/**
 * Extracts all classes that are referenced in a module's `declarations` array.
 * @param ngModule Module whose declarations are being extraced.
 * @param templateTypeChecker
 */
function extractDeclarationsFromModule(
  ngModule: ts.ClassDeclaration,
  templateTypeChecker: TemplateTypeChecker,
): ts.ClassDeclaration[] {
  const metadata = templateTypeChecker.getNgModuleMetadata(ngModule);
  return metadata
    ? (metadata.declarations
        .filter((decl) => ts.isClassDeclaration(decl.node))
        .map((decl) => decl.node) as ts.ClassDeclaration[])
    : [];
}

///**
// * Migrates the `declarations` from a unit test file to standalone.
// * @param testObjects Object literals used to configure the testing modules.
// * @param declarationsOutsideOfTestFiles Non-testing declarations that are part of this migration.
// * @param tracker
// * @param templateTypeChecker
// * @param typeChecker
// */
//export function migrateTestDeclarations(
//  testObjects: Set<ts.ObjectLiteralExpression>,
//  declarationsOutsideOfTestFiles: Set<ts.ClassDeclaration>,
//  tracker: ChangeTracker,
//  templateTypeChecker: TemplateTypeChecker,
//  typeChecker: ts.TypeChecker,
//) {
//  const { decorators, componentImports } = analyzeTestingModules(
//    testObjects,
//    typeChecker,
//  );
//  const allDeclarations = new Set(declarationsOutsideOfTestFiles);
//
//  for (const decorator of decorators) {
//    const closestClass = closestNode(decorator.node, ts.isClassDeclaration);
//
//    if (decorator.name === "Pipe" || decorator.name === "Directive") {
//      tracker.replaceNode(
//        decorator.node,
//        markDecoratorAsStandalone(decorator.node),
//      );
//
//      if (closestClass) {
//        allDeclarations.add(closestClass);
//      }
//    } else if (decorator.name === "Component") {
//      const newDecorator = markDecoratorAsStandalone(decorator.node);
//      const importsToAdd = componentImports.get(decorator.node);
//
//      if (closestClass) {
//        allDeclarations.add(closestClass);
//      }
//
//      if (importsToAdd && importsToAdd.size > 0) {
//        const hasTrailingComma =
//          importsToAdd.size > 2 &&
//          !!extractMetadataLiteral(decorator.node)?.properties.hasTrailingComma;
//        const importsArray = ts.factory.createNodeArray(
//          Array.from(importsToAdd),
//          hasTrailingComma,
//        );
//
//        tracker.replaceNode(
//          decorator.node,
//          setPropertyOnAngularDecorator(
//            newDecorator,
//            "imports",
//            ts.factory.createArrayLiteralExpression(importsArray),
//          ),
//        );
//      } else {
//        tracker.replaceNode(decorator.node, newDecorator);
//      }
//    }
//  }
//
//  for (const obj of testObjects) {
//    moveDeclarationsToImports(
//      obj,
//      allDeclarations,
//      typeChecker,
//      templateTypeChecker,
//      tracker,
//    );
//  }
//}

/**
 * Analyzes a set of objects used to configure testing modules and returns the AST
 * nodes that need to be migrated and the imports that should be added to the imports
 * of any declared components.
 * @param testObjects Object literals that should be analyzed.
 */
function analyzeTestingModules(
  testObjects: Set<ts.ObjectLiteralExpression>,
  typeChecker: ts.TypeChecker,
) {
  const seenDeclarations = new Set<ts.Declaration>();
  const decorators: NgDecorator[] = [];
  const componentImports = new Map<ts.Decorator, Set<ts.Expression>>();

  for (const obj of testObjects) {
    const declarations = extractDeclarationsFromTestObject(obj, typeChecker);

    if (declarations.length === 0) {
      continue;
    }

    const importsProp = findLiteralProperty(obj, "imports");
    const importElements =
      importsProp &&
      hasNgModuleMetadataElements(importsProp) &&
      ts.isArrayLiteralExpression(importsProp.initializer)
        ? importsProp.initializer.elements.filter((el) => {
            // Filter out calls since they may be a `ModuleWithProviders`.
            return (
              !ts.isCallExpression(el) &&
              // Also filter out the animations modules since they throw errors if they're imported
              // multiple times and it's common for apps to use the `NoopAnimationsModule` to
              // disable animations in screenshot tests.
              !isClassReferenceInAngularModule(
                el,
                /^BrowserAnimationsModule|NoopAnimationsModule$/,
                "platform-browser/animations",
                typeChecker,
              )
            );
          })
        : null;

    for (const decl of declarations) {
      if (seenDeclarations.has(decl)) {
        continue;
      }

      const [decorator] = getAngularDecorators(
        typeChecker,
        ts.getDecorators(decl) || [],
      );

      if (decorator) {
        seenDeclarations.add(decl);
        decorators.push(decorator);

        if (decorator.name === "Component" && importElements) {
          // We try to de-duplicate the imports being added to a component, because it may be
          // declared in different testing modules with a different set of imports.
          let imports = componentImports.get(decorator.node);
          if (!imports) {
            imports = new Set();
            componentImports.set(decorator.node, imports);
          }
          importElements.forEach((imp) => imports!.add(imp));
        }
      }
    }
  }

  return { decorators, componentImports };
}

/**
 * Finds the class declarations that are being referred
 * to in the `declarations` of an object literal.
 * @param obj Object literal that may contain the declarations.
 * @param typeChecker
 */
function extractDeclarationsFromTestObject(
  obj: ts.ObjectLiteralExpression,
  typeChecker: ts.TypeChecker,
): ts.ClassDeclaration[] {
  const results: ts.ClassDeclaration[] = [];
  const declarations = findLiteralProperty(obj, "declarations");

  if (
    declarations &&
    hasNgModuleMetadataElements(declarations) &&
    ts.isArrayLiteralExpression(declarations.initializer)
  ) {
    for (const element of declarations.initializer.elements) {
      const declaration = findClassDeclaration(element, typeChecker);

      // Note that we only migrate classes that are in the same file as the testing module,
      // because external fixture components are somewhat rare and handling them is going
      // to involve a lot of assumptions that are likely to be incorrect.
      if (
        declaration &&
        declaration.getSourceFile().fileName === obj.getSourceFile().fileName
      ) {
        results.push(declaration);
      }
    }
  }

  return results;
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

/**
 * Checks whether a class is a standalone declaration.
 * @param node Class being checked.
 * @param declarationsInMigration Classes that are being converted to standalone in this migration.
 * @param templateTypeChecker
 */
function isStandaloneDeclaration(
  node: ts.ClassDeclaration,
  declarationsInMigration: Set<ts.ClassDeclaration>,
  templateTypeChecker: TemplateTypeChecker,
): boolean {
  if (declarationsInMigration.has(node)) {
    return true;
  }

  const metadata =
    templateTypeChecker.getDirectiveMetadata(node) ||
    templateTypeChecker.getPipeMetadata(node);
  return metadata != null && metadata.isStandalone;
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
 * Finds the class declaration that is being referred to by a node.
 * @param reference Node referring to a class declaration.
 * @param typeChecker
 */
export function findClassDeclaration(
  reference: ts.Node,
  typeChecker: ts.TypeChecker,
): ts.ClassDeclaration | null {
  return (
    typeChecker
      .getTypeAtLocation(reference)
      .getSymbol()
      ?.declarations?.find(ts.isClassDeclaration) || null
  );
}

/**
 * Checks whether a node is referring to a specific class declaration.
 * @param node Node that is being checked.
 * @param className Name of the class that the node might be referring to.
 * @param moduleName Name of the Angular module that should contain the class.
 * @param typeChecker
 */
export function isClassReferenceInAngularModule(
  node: ts.Node,
  className: string | RegExp,
  moduleName: string,
  typeChecker: ts.TypeChecker,
): boolean {
  const symbol = typeChecker.getTypeAtLocation(node).getSymbol();
  const externalName = `@angular/${moduleName}`;
  const internalName = `angular2/rc/packages/${moduleName}`;

  return !!symbol?.declarations?.some((decl) => {
    const closestClass = closestOrSelf(decl, ts.isClassDeclaration);
    const closestClassFileName = closestClass?.getSourceFile().fileName;

    if (
      !closestClass ||
      !closestClassFileName ||
      !closestClass.name ||
      !ts.isIdentifier(closestClass.name) ||
      (!closestClassFileName.includes(externalName) &&
        !closestClassFileName.includes(internalName))
    ) {
      return false;
    }

    return typeof className === "string"
      ? closestClass.name.text === className
      : className.test(closestClass.name.text);
  });
}

/**
 * Gets the closest node that matches a predicate, including the node that the search started from.
 * @param node Node from which to start the search.
 * @param predicate Predicate that the result needs to pass.
 */
export function closestOrSelf<T extends ts.Node>(
  node: ts.Node,
  predicate: (n: ts.Node) => n is T,
): T | null {
  return predicate(node) ? node : closestNode(node, predicate);
}
