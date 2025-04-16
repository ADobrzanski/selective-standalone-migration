import { IncomingMessage, Server, ServerResponse } from "http";
import {
  getDataFromGlobalNodeId,
  getGlobalNodeId,
  isSourceFile,
} from "../tsc.helpers";
import { getAtPath } from "../helpers";
import { ScriptContext } from "../main";
import {
  a,
  div,
  getDocument,
  renderComponentListItemEntry,
  renderDirectiveListItemEntry,
} from "../html.helpers";
import { getComponentImportExpressions } from "../angular-tsc.helpers";
import ts from "typescript";
import { NgElementType } from "../types/ng-element.enum";

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
    .filter((element) => element.type === NgElementType.Component)
    .find((component) => getGlobalNodeId(component.cls) === globalNodeId);

  if (!component) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Component not found in file.");
    return;
  }

  const declaredIn = context.checker.ng.getOwningNgModule(component.cls);

  const usedDirectives =
    context.checker.ng.getUsedDirectives(component.cls) ?? [];
  // context.checker.ng.getPotentialTemplateDirectives(component.cls) ?? [];
  // console.log("getTemplate", context.checker.ng.getTemplate(component.cls));

  const meta = context.checker.ng.getDirectiveMetadata(component.cls);

  const title = [
    div(null, `Name: ${component.cls.name?.escapedText}`),
    div(null, `- selector: ${meta?.selector}`),
    div(
      null,
      `Declared in: ${declaredIn ? declaredIn.name?.escapedText : "standalone"}`,
    ),
  ].join("");

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
    a(
      {
        href: `/migrate-single/${encodeURIComponent(getGlobalNodeId(component.cls))}`,
      },
      "Make standalone",
    ),
    div(
      null,
      context.checker.ng
        .getTemplate(component.cls)
        ?.map((_) => _.sourceSpan.toString())
        .join(),
    ),
  ].join("");

  const html = [title, componentsHTML].join(`<hr>`);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(html));
};
