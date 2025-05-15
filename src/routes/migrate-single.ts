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
import ts, { Expression, TypeChecker } from "typescript";
import { XMLParser } from "fast-xml-parser";

import { ChangeTracker, ImportRemapper } from "../../utils/change_tracker";
import { getAngularDecorators, NgDecorator } from "../../utils/ng_decorators";
import { closestNode } from "../../utils/typescript/nodes";
import { ScriptContext, context } from "../main";
import { NgElementType } from "../types/ng-element.enum";
import { NamedClassDeclaration } from "../angular-tsc.helpers";
import { relative, dirname } from "path";
import * as fs from "fs";
import { isClassImported } from "./migrate-single/utils";

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { FastifyPluginAsync } from "fastify";
import { noElementWithId, notOfType } from "./api-responses";

/**
 * Function that can be used to prcess the dependencies that
 * are going to be added to the imports of a declaration.
 */
export type DeclarationImportsRemapper = (
  imports: PotentialImport[],
) => PotentialImport[];

export const toStandaloneRoute: FastifyPluginAsync = async (
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) => {
  fastify.get("/component/:id/$makeStandalone", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const params = request.params as Record<string, string>;

    const id = Number(params.id);
    const force = query.force?.toLowerCase() === "true";

    const component = context.elements.at(id);

    if (!component) {
      reply.status(404).send(noElementWithId(id));
      return;
    }

    if (component.type !== NgElementType.Component) {
      reply.status(404).send(notOfType({ id, type: NgElementType.Component }));
      return;
    }

    const printer = ts.createPrinter();

    const migrationBlockers = findMigrationBlockers({
      classDeclaration: component.cls,
      templateTypeChecker: context.checker.ng,
    });
    if (migrationBlockers && !force) {
      const error = createMigrationBlockersError({
        classDeclaration: component.cls,
        templateTypeChecker: context.checker.ng,
        migrationBlockers,
      });

      reply.status(409).send({
        ...error,
        sameModuleDepenencies: migrationBlockers.sameModuleDependencies.map(
          (dep) => dep.name?.text,
        ),
        sameModuleConsumers: migrationBlockers.sameModuleConsumers.map(
          (consumer) => consumer.name?.text,
        ),
      });
      return;
    }

    console.log("about to migrate");
    const dependencies = getSameModuleDependenciesDeep({
      classDeclaration: component.cls,
      templateTypeChecker: context.checker.ng,
    });
    toStandalone(
      context.source.files,
      [component.cls, ...dependencies],
      context,
      printer,
    );

    reply.status(200).send();
    context.server.close();
  });
};

function createMigrationBlockersError(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
  migrationBlockers: MigrationBlockers;
}) {
  const { sameModuleDependencies, sameModuleConsumers } =
    data.migrationBlockers;

  const componentName = data.classDeclaration.name?.text;
  const owningModuleName = data.templateTypeChecker.getOwningNgModule(
    data.classDeclaration,
  )?.name?.text;

  return {
    error: "Migration would result in circular dependecy.",
    details:
      `${componentName} is currently declared in ${owningModuleName}.` +
      ` There are ${sameModuleConsumers.length} component(s) declared in that module depending on ${componentName}.` +
      ` There are also ${sameModuleDependencies.length} dependencies declared in that module ${componentName} uses.` +
      ` Migrating ${componentName} would result in circular dependecy. Migrate either said consumers or dependencies first to prevent this issue.`,
  };
}

export interface MigrationBlockers {
  sameModuleConsumers: ts.ClassDeclaration[];
  sameModuleDependencies: ts.ClassDeclaration[];
}

export function findMigrationBlockers(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
}): MigrationBlockers | null {
  const { classDeclaration, templateTypeChecker } = data;

  const selector =
    templateTypeChecker.getDirectiveMetadata(classDeclaration)?.selector;
  if (!selector)
    throw Error(
      "Cannot check templates for usage if component has no selector.",
    );

  const sameModuleConsumers = getSameModuleConsumers(data).map(
    (consumer) => consumer.cls,
  );
  // no consumers in owning module means no need to import migrated component back
  if (sameModuleConsumers.length === 0) return null;

  const sameModuleDependencies = getSameModuleDependenciesDeep(data);
  // no dependencies in owning module means no need to import module into migrated component
  if (sameModuleDependencies.length === 0) return null;

  return { sameModuleConsumers, sameModuleDependencies };
}

function getAllConsumers(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
}) {
  const { classDeclaration, templateTypeChecker } = data;

  const selector =
    templateTypeChecker.getDirectiveMetadata(classDeclaration)?.selector;

  if (!selector)
    throw Error(
      "Cannot check templates for usage if component has no selector.",
    );

  const allConsumers = context.elements.filter((potentialConsumer) => {
    // only components have templates
    if (potentialConsumer.type !== NgElementType.Component) return false;

    const potentialConsumerOwningModule = templateTypeChecker.getOwningNgModule(
      potentialConsumer.cls,
    );
    // disregard standalone components
    if (!potentialConsumerOwningModule) return false;

    const template = getTemplateOrNull(potentialConsumer.decorator.node);
    if (!template) return false;

    // check if template includes tag matching component's selector
    // WARNING: naive method, will not handle complex selectors
    return getAllXmlTags(template).includes(selector);
  });

  return allConsumers;
}

function getSameModuleConsumers(data: {
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

  return sameModuleConsumers;
}

function getSameModuleDependenciesDeep(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
}) {
  const { templateTypeChecker } = data;

  const queue = getSameModuleDependencies(data);
  const result: NamedClassDeclaration[] = [];

  while (queue.length > 0) {
    const classDeclaration = queue.splice(0, 1)[0];
    result.push(classDeclaration);
    queue.push(
      ...getSameModuleDependencies({ classDeclaration, templateTypeChecker }),
    );
  }

  return result;
}

function getSameModuleDependencies(data: {
  classDeclaration: ts.ClassDeclaration;
  templateTypeChecker: TemplateTypeChecker;
}) {
  const templateDependencies = findTemplateDependencies(
    data.classDeclaration,
    data.templateTypeChecker,
  );
  if (!templateDependencies || templateDependencies.length < 1) return [];

  const owningModule = data.templateTypeChecker.getOwningNgModule(
    data.classDeclaration,
  );
  const sameModuleDependencies = templateDependencies.filter(
    (dep) =>
      data.templateTypeChecker.getOwningNgModule(dep.node) === owningModule,
  );

  return sameModuleDependencies.map((_) => _.node);
}

/**
 * Converts all declarations in the specified files to standalone.
 * @param program
 * @param printer
 * @param fileImportRemapper Optional function that can be used to remap file-level imports.
 * @param declarationImportRemapper Optional function that can be used to remap declaration-level
 * imports.
 */
export function toStandalone(
  sourceFiles: readonly ts.SourceFile[],
  toMigrate: ts.ClassDeclaration[],
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
  // const declarations = new Set<ts.ClassDeclaration>();
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

  for (const declaration of toMigrate) {
    convertNgModuleDeclarationToStandalone(
      declaration,
      new Set(toMigrate),
      tracker,
      templateTypeChecker,
      declarationImportRemapper,
    );
  }

  migrateOwningModule({ toMigrate, templateTypeChecker, typeChecker, tracker });

  importNewStandaloneInConsumers({ toMigrate, tracker, templateTypeChecker });

  for (const sourceFile of sourceFiles) {
    makeRelatedNamedImportsAbsolute({
      toMigrate,
      tracker,
      sourceFile,
      typeChecker,
      printer,
    });
  }

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

function migrateOwningModule(data: {
  toMigrate: ts.ClassDeclaration[];
  templateTypeChecker: TemplateTypeChecker;
  typeChecker: TypeChecker;
  tracker: ChangeTracker;
}): void {
  const module = data.templateTypeChecker.getOwningNgModule(data.toMigrate[0])!;

  const decorator = data.templateTypeChecker.getPrimaryAngularDecorator(module);
  if (!decorator) return;

  const metadata = extractMetadataLiteral(decorator);
  if (!metadata) return;

  const declarations = findLiteralProperty(metadata, "declarations");
  if (!declarations) return;

  const declarationsOutsideDecorator: ts.Identifier[] = [];

  data.toMigrate.forEach((declToMigrate) => {
    const identifier = findIdentifierInCollectionNaively({
      array: declarations,
      // expect component to be named class
      identifierToFind: declToMigrate.name!.text,
      typeChecker: data.typeChecker,
    });

    /* couldn't find identifier; won't migrate */
    if (!identifier) return;

    if (!isNodeWithinAnother({ node: identifier, within: declarations })) {
      declarationsOutsideDecorator.push(identifier);
    }
  });

  let updatedDecoratorProperties: ts.ObjectLiteralElementLike[] = [];

  /* { declarations: something } */
  updateDecoratorDeclarations: if (ts.isPropertyAssignment(declarations)) {
    const initializer = declarations.initializer;
    /* { declarations: [some, stuff] } */
    if (!ts.isArrayLiteralExpression(initializer))
      break updateDecoratorDeclarations;

    const updatedDeclarations = initializer.elements.filter(
      (el) =>
        !ts.isIdentifier(el) ||
        !data.toMigrate.find((cls) => cls.name!.text === el.text),
    );

    const updatedDecoratorDeclarations = ts.factory.updatePropertyAssignment(
      declarations,
      declarations.name,
      ts.factory.createArrayLiteralExpression(updatedDeclarations),
    );

    updatedDecoratorProperties.push(updatedDecoratorDeclarations);
  }

  const imports = findLiteralProperty(metadata, "imports");
  const newImports = data.toMigrate.map((cls) => cls.name!);

  /* if module does not import anything yet */
  if (!imports) {
    /* create imports declaration to add */
    const newImportsProperty = ts.factory.createPropertyAssignment(
      "imports",
      ts.factory.createArrayLiteralExpression(newImports),
    );

    updatedDecoratorProperties.push(newImportsProperty);
  } else if (
    /* if module has imports in form of array literal: { imports: [stuff, here] } */
    ts.isPropertyAssignment(imports) &&
    ts.isArrayLiteralExpression(imports.initializer)
  ) {
    const newImportsProperty = ts.factory.createArrayLiteralExpression([
      ...imports.initializer.elements,
      ...newImports,
    ]);

    const updatedImportsProperty = ts.factory.updatePropertyAssignment(
      imports,
      imports.name,
      newImportsProperty,
    );

    updatedDecoratorProperties.push(updatedImportsProperty);
  } else if (ts.isShorthandPropertyAssignment(imports)) {
    /* if module has imports in form of shorthand assignment { imports } */
    /* spread exising imports and add new: { imports: [...imports, new, stuff] } */
    const newImportsProperty = ts.factory.createArrayLiteralExpression([
      ts.factory.createSpreadElement(ts.factory.createIdentifier("imports")),
      ...newImports,
    ]);

    const updatedImportsProperty = ts.factory.createPropertyAssignment(
      "imports",
      newImportsProperty,
    );

    updatedDecoratorProperties.push(updatedImportsProperty);
  }

  const newDecoratorProperties = metadata.properties
    .map((existingProperty) => {
      if (!isNamedPropertyAssignment(existingProperty)) return existingProperty;

      const updatedProperty = updatedDecoratorProperties.find(
        (updatedProperty) =>
          propertyNamesEqual(existingProperty, updatedProperty),
      );

      if (updatedProperty) {
        /* drop this property from the list of updated properties */
        updatedDecoratorProperties = updatedDecoratorProperties.filter(
          (p) => p !== updatedProperty,
        );
        return updatedProperty;
      }

      return existingProperty;
    })
    .concat(updatedDecoratorProperties);

  data.tracker.replaceNode(
    metadata,
    ts.factory.updateObjectLiteralExpression(
      metadata,
      ts.factory.createNodeArray(
        newDecoratorProperties,
        metadata.properties.hasTrailingComma,
      ),
    ),
    ts.EmitHint.Expression,
  );

  const declarationsGroupedByArrays = new Map<
    ts.ArrayLiteralExpression,
    ts.Identifier[]
  >([]);
  declarationsOutsideDecorator.forEach((identifier) => {
    const containingArray = identifier.parent;

    /* we expect declarations to be in array; ignore other cases (are there any?) */
    if (!ts.isArrayLiteralExpression(containingArray)) return;

    if (!declarationsGroupedByArrays.has(containingArray))
      declarationsGroupedByArrays.set(containingArray, []);

    declarationsGroupedByArrays.get(containingArray)!.push(identifier);
  });

  for (let [array, toRemove] of declarationsGroupedByArrays.entries()) {
    data.tracker.replaceNode(
      array,
      ts.factory.createArrayLiteralExpression(
        array.elements.filter((el) => !(toRemove as Expression[]).includes(el)),
      ),
    );
  }
}

function propertyNamesEqual(
  propA: ts.ObjectLiteralElementLike,
  propB: ts.ObjectLiteralElementLike,
) {
  return getPropertyName(propA) === getPropertyName(propB);
}

function getPropertyName(
  prop: ts.ObjectLiteralElementLike,
): string | undefined {
  if (isNamedPropertyAssignment(prop)) return prop.name.text;
  return undefined;
}

function isNodeWithinAnother(data: {
  node: ts.Node;
  within: ts.Node;
}): boolean {
  return (
    data.node.getStart() >= data.within.getStart() &&
    data.node.getEnd() <= data.within.getEnd()
  );
}

function findIdentifierInCollectionNaively(data: {
  array: ts.ObjectLiteralElementLike;
  identifierToFind: string;
  typeChecker: TypeChecker;
}): ts.Identifier | undefined {
  const { array } = data;

  if (ts.isPropertyAssignment(array)) {
    /* case of { property: variable } */
    if (ts.isIdentifier(array.initializer)) {
      const symbol = data.typeChecker.getSymbolAtLocation(array.initializer);

      const variableDeclaration = symbol?.declarations?.find((declaration) =>
        ts.isVariableDeclaration(declaration),
      ) as ts.VariableDeclaration;
      /* ignore lack of declaration (decl. in another file) */
      if (!variableDeclaration) return undefined;

      const variableInitizlizer = variableDeclaration.initializer;
      /* ignore cases other than `variable = [some, array];` */
      if (
        !variableInitizlizer ||
        !ts.isArrayLiteralExpression(variableInitizlizer)
      )
        return undefined;

      return variableInitizlizer.elements.find(
        (element) =>
          ts.isIdentifier(element) && element.text === data.identifierToFind,
      ) as ts.Identifier | undefined;
    } else if (ts.isArrayLiteralExpression(array.initializer)) {
      /* case of { property: [some, stuff, ...here] } */
      return array.initializer.elements.find(
        (element) =>
          ts.isIdentifier(element) && element.text === data.identifierToFind,
      ) as ts.Identifier | undefined;
    }
  }

  /* case of { property } where property is both key and a variable */
  if (ts.isShorthandPropertyAssignment(data.array)) {
    const symbol = data.typeChecker.getSymbolAtLocation(data.array);
    const variableDeclaration = symbol?.declarations?.find((declaration) =>
      ts.isVariableDeclaration(declaration),
    ) as ts.VariableDeclaration;
    /* ignore lack of declaration (decl. in another file) */
    if (!variableDeclaration) return undefined;

    const variableInitizlizer = variableDeclaration.initializer;
    /* ignore cases other than `variable = [some, array];` */
    if (
      !variableInitizlizer ||
      !ts.isArrayLiteralExpression(variableInitizlizer)
    )
      return undefined;

    return variableInitizlizer.elements.find(
      (element) =>
        ts.isIdentifier(element) && element.text === data.identifierToFind,
    ) as ts.Identifier | undefined;
  }

  return undefined;
}

/**
 * Finds all places migrated dependency is being used and updates the imports.
 * @param decl Declaration being converted.
 * @param tracker Tracker used to track the file changes.
 * @param typeChecker
 * @param importRemapper
 */
function importNewStandaloneInConsumers(data: {
  toMigrate: ts.ClassDeclaration[];
  tracker: ChangeTracker;
  templateTypeChecker: TemplateTypeChecker;
  importRemapper?: DeclarationImportsRemapper;
}): void {
  const { toMigrate, tracker, templateTypeChecker } = data;
  // assuming we only migrate 1 component and it's dependencies
  const toMigrateOwningModule = templateTypeChecker.getOwningNgModule(
    toMigrate[0],
  );
  if (!toMigrateOwningModule) return;

  const importsPerModuleLike = new Map<
    ts.ClassDeclaration,
    ts.ClassDeclaration[]
  >([]);
  const queueImport = (importData: {
    moduleLike: ts.ClassDeclaration;
    classDeclaration: ts.ClassDeclaration;
  }) => {
    const imports = importsPerModuleLike.get(importData.moduleLike) ?? [];
    importsPerModuleLike.set(importData.moduleLike, [
      ...imports,
      importData.classDeclaration,
    ]);
  };

  for (let classDeclaration of toMigrate) {
    const directConsumers = getAllConsumers({
      classDeclaration,
      templateTypeChecker,
    });
    const moduleLikeConsumersList = directConsumers
      // migration targets modified separately - @see convertNgModuleDeclarationToStandalone()
      .filter((consumer) => !toMigrate.includes(consumer.cls))
      .map(
        (consumer) =>
          templateTypeChecker.getOwningNgModule(consumer.cls) ?? consumer.cls,
      );
    const moduleLikeConsumersSet = new Set(moduleLikeConsumersList);

    // owning module modified separately - @see migrateOwningModule()
    moduleLikeConsumersSet.delete(toMigrateOwningModule);

    for (let moduleLike of moduleLikeConsumersSet.values()) {
      queueImport({ moduleLike, classDeclaration });
    }
  }

  const addFileImportIfNotExists = (importData: {
    moduleLike: ts.ClassDeclaration;
    classDeclaration: ts.ClassDeclaration;
  }) => {
    const { moduleLike, classDeclaration } = importData;
    if (!classDeclaration.name) return;

    const sourceFile = moduleLike.getSourceFile();

    if (
      isClassImported({
        classDeclaration,
        sourceFile,
        typeChecker: context.checker.ts,
      })
    )
      return;

    // add import (using project-scoped absolute path)
    tracker.addImport(
      moduleLike.getSourceFile(),
      classDeclaration.name.text,
      // drop '.ts' extension from final import path
      relative(
        context.basePath,
        classDeclaration.getSourceFile().fileName,
      ).slice(0, -3),
    );
  };

  for (let moduleLike of importsPerModuleLike.keys()) {
    const classesToImport = importsPerModuleLike.get(moduleLike);
    if (!classesToImport) continue;

    classesToImport.forEach((classDeclaration) =>
      addFileImportIfNotExists({ moduleLike, classDeclaration }),
    );

    // reference class inside `imports` of module or standalone component
    addImportsToModuleLike({
      import: classesToImport,
      to: moduleLike,
      tracker,
    });
  }
}

function makeRelatedNamedImportsAbsolute(data: {
  sourceFile: ts.SourceFile;
  toMigrate: ts.ClassDeclaration[];
  tracker: ChangeTracker;
  typeChecker: TypeChecker;
  printer: ts.Printer;
}) {
  const {
    sourceFile,
    toMigrate: classDeclarations,
    tracker,
    typeChecker,
    printer,
  } = data;

  const foundImports: ts.ImportSpecifier[] = [];

  // Traverse the source file to find import declarations
  function processNode(node: ts.Node) {
    // Check if the node is an import declaration with an import clause
    processing: {
      if (!ts.isImportDeclaration(node) || !node.importClause) break processing;

      const importClause = node.importClause;
      const namedBindings = importClause.namedBindings;

      // Check for named imports (not namespace imports)
      if (!namedBindings || !ts.isNamedImports(namedBindings)) break processing;

      const elements = namedBindings.elements;

      // Filter out the imports we want to remove
      const remainingElements = elements.filter((element) => {
        const toRemove = classDeclarations.some((declaration) =>
          doesImportReferenceClassDeclaration({
            typeChecker,
            declaration,
            import: element,
          }),
        );
        if (toRemove) {
          foundImports.push(element);
        }
        return !toRemove;
      });

      if (remainingElements.length === 0) {
        // If all named imports are removed
        if (!importClause.name) {
          // No default import exists, remove the entire import declaration
          tracker.removeNode(node);
        } else {
          // Default import exists, create a new import clause without named imports
          const newImportClause = ts.factory.createImportClause(
            importClause.isTypeOnly,
            importClause.name,
            undefined,
          );
          tracker.replaceNode(importClause, newImportClause);
        }
      } else if (remainingElements.length !== elements.length) {
        // Some imports remain, create a new named imports node to handle commas correctly
        const newNamedImports =
          ts.factory.createNamedImports(remainingElements);
        tracker.replaceNode(namedBindings, newNamedImports);
      }
    }

    // Continue traversal
    ts.forEachChild(node, processNode);
  }

  // Start the traversal
  processNode(sourceFile);

  foundImports.forEach((foundImport) => {
    const targetClass = classDeclarations.find((declaration) =>
      doesImportReferenceClassDeclaration({
        declaration,
        typeChecker,
        import: foundImport,
      }),
    );

    if (!targetClass) return;

    // drop '.ts' extension from final import path
    const newImportPath = relative(
      context.basePath,
      targetClass.getSourceFile().fileName,
    ).slice(0, -3);

    const newImport = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier(targetClass.name!.text),
          ),
        ]),
      ),
      ts.factory.createStringLiteral(newImportPath),
    );

    const newImportText =
      "\n" + printer.printNode(ts.EmitHint.Unspecified, newImport, sourceFile);

    // add import (using project-scoped absolute path)
    tracker.insertText(sourceFile, 0, newImportText);
  });
}

function doesImportReferenceClassDeclaration(data: {
  import: ts.ImportSpecifier;
  declaration: ts.ClassDeclaration;
  typeChecker: ts.TypeChecker;
}): boolean | undefined {
  const classSymbol = data.typeChecker.getSymbolAtLocation(
    data.declaration.name!,
  );
  if (!classSymbol) return undefined;

  const localSymbol = data.typeChecker.getSymbolAtLocation(data.import.name);
  if (localSymbol === classSymbol) return true;

  if (!localSymbol) return;

  return (
    data.typeChecker.getAliasedSymbol(localSymbol) === classSymbol ||
    localSymbol.valueDeclaration === data.declaration
  );
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

/**
 * Moves all the symbol references from the `declarations` array to the `imports`
 * array of an `NgModule` class and removes the `declarations`.
 * @param literal Object literal used to configure the module that should be migrated.
 * @param typeChecker
 * @param tracker
 */
function addImportsToModuleLike(data: {
  import: ts.ClassDeclaration[];
  to: ts.ClassDeclaration;
  tracker: ChangeTracker;
}): void {
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

  const newImport = data.import.map((_) =>
    ts.factory.createIdentifier(_.name!.text),
  );

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
            [...prop.initializer.elements, ...newImport],
            prop.initializer.elements.hasTrailingComma,
          ),
        );
      } else {
        initializer = ts.factory.createArrayLiteralExpression(
          ts.factory.createNodeArray(
            [ts.factory.createSpreadElement(prop.initializer), ...newImport],
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
  // if (
  //   !standaloneProp ||
  //   standaloneProp.initializer.kind !== ts.SyntaxKind.FalseKeyword
  // ) {
  //   return node;
  // }

  const newProperties = [
    ...metadata.properties.filter((element) => element !== standaloneProp),
    ts.factory.createPropertyAssignment("standalone", ts.factory.createTrue()),
  ];

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
