import { IncomingMessage, Server, ServerResponse } from "http";
import { getDocument, renderComponentListItemEntry } from "../html.helpers";
import { ScriptContext } from "../main";
import { NgElementType } from "../types/ng-element.enum";

export const handleComponents = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const components = context.elements.filter(
    (element) => element.type === NgElementType.Component,
  );

  const content = components.reduce((acc, component) => {
    return (
      acc + renderComponentListItemEntry(component.cls, context.checker.ng)
    );
  }, "");

  const css = `
      .block { display: block; }
    `;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content, css));
};
