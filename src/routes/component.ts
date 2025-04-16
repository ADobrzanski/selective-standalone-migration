import { IncomingMessage, Server, ServerResponse } from "http";
import {
  getDataFromGlobalNodeId,
  getGlobalNodeId,
  isSourceFile,
} from "../tsc.helpers";
import { getAtPath } from "../helpers";
import { ScriptContext } from "../main";
import {
  div,
  getDocument,
  renderComponentListItemEntry,
  renderDirectiveListItemEntry,
} from "../html.helpers";
import { getComponentImportExpressions } from "../angular-tsc.helpers";
import ts from "typescript";
import { NgElement } from "../types/ng-element.enum";

export const handleComponent = (
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
    .filter((element) => element.type === NgElement.Component)
    .find((component) => getGlobalNodeId(component.cls) === globalNodeId);

  if (!component) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Component not found in file.");
    return;
  }

  const declaredIn = context.checker.ng.getOwningNgModule(component.cls);

  const usedDirectives =
    context.checker.ng.getUsedDirectives(component.cls) ?? [];

  const nameTag = div(null, `Name: ${component.cls.name?.escapedText}`);
  const declaredInTag = div(
    null,
    `Declared in: ${declaredIn ? declaredIn.name?.escapedText : "standalone"}`,
  );
  const title = nameTag + declaredInTag;

  const componentsHTML = [
    div(null, "Used components:"),
    ...usedDirectives
      .filter((directive) => directive.isComponent)
      .map((directive) => {
        const declaration = directive.ref.node;
        return renderComponentListItemEntry(
          declaration as ts.ClassDeclaration,
          context.checker.ng,
        );
      }),
    div(null, "Used directives:"),
    ...usedDirectives
      .filter((directive) => !directive.isComponent)
      .map((directive) => {
        const declaration = directive.ref.node;
        return renderDirectiveListItemEntry(
          declaration as ts.ClassDeclaration,
          context.checker.ng,
        );
      }),
    div(null, "Potential imports:"),
    ...getComponentImportExpressions(
      component.cls,
      new Set(context.elements.map((_) => _.cls)),
      context.checker.ng,
    ).map((potentialImport) => div(null, potentialImport.symbolName)),
  ].join("");

  const html = [title, componentsHTML].join(`<hr>`);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(html));
};
