import { createProgramOptions } from "./utils/typescript/compiler_host";
import { getProjectTsConfigPaths } from "./utils/project_tsconfig_paths";
import ts from "typescript";
import { NgtscProgram } from "@angular/compiler-cli";
import { TemplateTypeChecker } from "@angular/compiler-cli/src/ngtsc/typecheck/api";
import { Tree } from "@angular-devkit/schematics";
import { FileTree } from "./new-helpers/file-tree.helpers";
import { findNgClasses } from "./angular-tsc.helpers";

class NgClass {
  constructor(public classDeclaration: ts.ClassDeclaration) {}
}

export type ScriptContext = {
  program: NgtscProgram;
  schematic: {
    tree: Tree;
  };
  checker: {
    ts: ts.TypeChecker;
    ng: TemplateTypeChecker;
  };
  source: {
    tree: FileTree;
    files: readonly ts.SourceFile[];
  };
  elements: NgClass[];
};

export function dependencyVisualizer(_options) {
  console.log("options", _options);
  return async (tree: Tree, _context) => {
    const basePath = process.cwd();
    const { buildPaths } = await getProjectTsConfigPaths(tree);
    const { createProgram } = await import("@angular/compiler-cli");

    for (const tsconfigPath of buildPaths) {
      // analyseDependencies({
      //   tree,
      //   basePath,
      //   tsconfigPath,
      //   createProgram,
      // });
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

  const program: NgtscProgram = data.createProgram({
    rootNames,
    host,
    options,
  });

  const tsChecker = program.getTsProgram().getTypeChecker();
  const ngChecker = program.compiler.getTemplateTypeChecker();

  const sourceFiles: readonly ts.SourceFile[] = program
    .getTsProgram()
    .getSourceFiles();

  const fileTree = new FileTree(sourceFiles);

  const elements = sourceFiles.flatMap((file) =>
    findNgClasses(file, tsChecker),
  );

  const context: ScriptContext = {
    program,
    schematic: {
      tree: data.tree,
    },
    source: {
      files: sourceFiles,
      tree: fileTree,
    },
    checker: {
      ts: tsChecker,
      ng: ngChecker,
    },
    elements,
  };
}

// local helpers
