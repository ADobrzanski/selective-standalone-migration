import { IncomingMessage, Server, ServerResponse } from "http";
import {
  getDataFromGlobalNodeId,
  getGlobalNodeId,
  isSourceFile,
} from "../tsc.helpers";
import { getAtPath } from "../helpers";
import { ScriptContext } from "../main";
import { a, div, getDocument, li, pre, ul } from "../html.helpers";
import { findTemplateDependencies } from "../angular-tsc.helpers";
import ts from "typescript";
import { NgElementType } from "../types/ng-element.enum";
import { ClassDeclaration } from "@angular/compiler-cli/src/ngtsc/reflection";

type Dep = { cls: ts.ClassDeclaration; deps: Dep[] };

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

  // local helpers
  const getDirectiveMetadata = (cls: ts.ClassDeclaration) =>
    context.checker.ng.getDirectiveMetadata(cls);
  const isStandalone = (cls: ts.ClassDeclaration) =>
    getDirectiveMetadata(cls)?.isStandalone;
  const getOwningNgModule = (cls: ts.ClassDeclaration) =>
    context.checker.ng.getOwningNgModule(cls);

  const meta = getDirectiveMetadata(component.cls);
  const declaredIn = getOwningNgModule(component.cls);

  function findDependencies(cls: ts.ClassDeclaration): Dep[] {
    return findTemplateDependencies(cls, context.checker.ng).map(
      ({ node }: { node: ts.ClassDeclaration }) => ({
        cls: node,
        deps: findDependencies(node),
      }),
    );
  }

  function renderDependencies(deps: Dep[]): string {
    return ul(
      null,
      deps
        .map((dep) =>
          li(
            { style: `color: ${isStandalone(dep.cls) ? "green" : "inherit"}` },
            dep.cls.name?.escapedText.toString() +
              (dep.deps.length === 0 ? "" : renderDependencies(dep.deps)),
          ),
        )
        .join(""),
    );
  }

  const title = [
    div(null, `Name: ${component.cls.name?.escapedText}`),
    div(null, `- selector: ${meta?.selector}`),
    div(
      null,
      `Declared in: ${isStandalone(component.cls) ? "standalone" : (declaredIn?.name?.escapedText ?? "unresolved")}`,
    ),
  ].join("");

  const componentsHTML = [
    div(null, "Dependencies:"),
    renderDependencies(findDependencies(component.cls)),
    a(
      {
        href: `/migrate-single/${encodeURIComponent(getGlobalNodeId(component.cls))}`,
      },
      "Make standalone",
    ),
    pre(
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
