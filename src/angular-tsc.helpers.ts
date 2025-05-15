import { Reference } from "@angular/compiler-cli/src/ngtsc/imports";
import { TemplateTypeChecker } from "@angular/compiler-cli/src/ngtsc/typecheck/api/checker";
import ts from "typescript";

/** Utility to type a class declaration with a name. */
export type NamedClassDeclaration = ts.ClassDeclaration & {
  name: ts.Identifier;
};

export enum PotentialImportMode {
  /** Whether an import is standalone is inferred based on its metadata. */
  Normal,

  /**
   * An import is assumed to be standalone and is imported directly. This is useful for migrations
   * where a declaration wasn't standalone when the program was created, but will become standalone
   * as a part of the migration.
   */
  ForceDirect,
}

export interface PotentialImport {
  kind: PotentialImportKind;
  // If no moduleSpecifier is present, the given symbol name is already in scope.
  moduleSpecifier?: string;
  symbolName: string;
  isForwardReference: boolean;
}

/**
 * Which kind of Angular Trait the import targets.
 */
export enum PotentialImportKind {
  NgModule,
  Standalone,
}

/**
 * Finds the import from which to bring in a template dependency of a component.
 * @param target Dependency that we're searching for.
 * @param inComponent Component in which the dependency is used.
 * @param importMode Mode in which to resolve the import target.
 * @param typeChecker
 */
export function findImportLocation(
  target: Reference<NamedClassDeclaration>,
  inComponent: ts.ClassDeclaration,
  importMode: PotentialImportMode,
  typeChecker: TemplateTypeChecker,
): PotentialImport | null {
  const importLocations = typeChecker.getPotentialImportsFor(
    target,
    inComponent,
    importMode,
  );
  let firstSameFileImport: PotentialImport | null = null;
  let firstModuleImport: PotentialImport | null = null;

  for (const location of importLocations) {
    // Prefer a standalone import, if we can find one.
    // Otherwise fall back to the first module-based import.
    if (location.kind === PotentialImportKind.Standalone) {
      return location;
    }
    if (!location.moduleSpecifier && !firstSameFileImport) {
      firstSameFileImport = location;
    }
    if (
      location.kind === PotentialImportKind.NgModule &&
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
