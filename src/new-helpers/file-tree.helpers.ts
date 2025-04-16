import ts from "typescript";

export class FileTree {
  fileTree: FsTreeNode = {};

  constructor(readonly sourceFiles: readonly ts.SourceFile[]) {
    sourceFiles
      .filter((file) => !file.fileName.includes("node_modules"))
      .forEach((file) => {
        const pathSegments = file.fileName.split("/").filter((_) => _);
        let currentFolder: FsTreeNode | ts.SourceFile = this.fileTree;

        pathSegments.forEach((segment) => {
          // if is file
          if (segment.includes(".")) {
            currentFolder[segment] = file;
          }

          // if is folder and not created yet
          if (!currentFolder[segment]) {
            currentFolder[segment] = {};
          }

          currentFolder = currentFolder[segment];
        });
      });
  }
}

export type FsTreeNode = { [pahtSegment: string]: FsTreeNode | ts.SourceFile };
