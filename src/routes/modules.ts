import { IncomingMessage, Server, ServerResponse } from "http";
import { a, getDocument, renderComponentListItemEntry } from "../html.helpers";
import {
  extractMetadataLiteral,
  getAllChildren,
  getClassDeclarationForImportedIdentifier,
  getGlobalNodeId,
} from "../tsc.helpers";
import { ScriptContext } from "../main";
import { NgElementType } from "../types/ng-element.enum";
import ts from "typescript";

type NgModuleDeclarationEntry = {
  name: ts.Identifier;
  class?: ts.ClassDeclaration;
};

export const handleModules = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const ngModules = context.elements
    .filter((element) => element.type === NgElementType.NgModule)
    .map((module) => {
      let declarations: NgModuleDeclarationEntry[] = [];
      const metadata = module && extractMetadataLiteral(module.decorator.node);
      if (!metadata) return { ...module, declarations };

      const declarationsNode = findLiteralProperty(metadata, "declarations");
      if (!declarationsNode || !hasNgModuleMetadataElements(declarationsNode))
        return { ...module, declarations };

      declarations = getAllChildren(declarationsNode.initializer)
        .filter((node) => ts.isIdentifier(node))
        .map((node) => {
          return {
            name: node as ts.Identifier,
            class: getClassDeclarationForImportedIdentifier(
              context.checker.ts,
              node,
            ),
          };
        });

      return { ...module, declarations };
    });

  const content = ngModules.reduce((acc, ngModule) => {
    const moduleId = getGlobalNodeId(ngModule.cls);
    const name = a(
      { href: `/module/${encodeURIComponent(moduleId)}`, class: "block" },
      ngModule.cls.name?.text ?? "NgModule (name unresolvable)",
    );
    // const declarations = ngModule.declarations
    //   .filter((declaration) => declaration.class)
    //   .map(
    //     (declaration) =>
    //       declaration.class &&
    //       renderComponentListItemEntry(declaration.class, context.checker.ng),
    //   )
    //   .join("");

    return acc + name;
  }, "");

  const css = `
      .block { display: block; }
    `;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDocument(content, css));
};

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
