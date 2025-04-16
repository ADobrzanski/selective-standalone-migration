import ts from "typescript";
import { isNil } from "./ts.helpers";
import { TemplateTypeChecker } from "@angular/compiler-cli/src/ngtsc/typecheck/api";
import { getGlobalNodeId } from "./tsc.helpers";

export const getDocument = (
  body: string,
  css?: string,
  script?: string,
): string =>
  `<!DOCTYPE html><html><head><style>${css ?? ""}</style> <script src="https://unpkg.com/htmx.org@2.0.1">${script ?? ""}</script></head><body>${body}</body></html>`;

export const getLink = (data: { href: string; label: string }) =>
  `<a href="${data.href}">${data.label}</a>`;

export const getTag = (
  name: string,
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
): string => {
  const attributeString = Object.entries(attributes ?? {})
    .filter(([_key, value]) => !isNil(value))
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");

  return `<${name} ${attributeString}>${content ?? ""}</${name}>`;
};

export const div = (
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
) => getTag("div", attributes, content);

export const ul = (
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
) => getTag("ul", attributes, content);

export const li = (
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
) => getTag("li", attributes, content);

export const a = (
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
) => getTag("a", attributes, content);

export const pre = (
  attributes?: Record<string, string | null | undefined> | null,
  content?: string | null,
) => getTag("pre", attributes, content);

export const renderComponentListItemEntry = (
  declaration: ts.ClassDeclaration,
  ngChecker: TemplateTypeChecker,
) => {
  const href = declaration
    ? `/component/${encodeURIComponent(getGlobalNodeId(declaration))}`
    : null;

  return a(
    { href, style: "display: block;" },
    `- ${declaration.name?.escapedText} (${ngChecker.getOwningNgModule(declaration)?.name?.escapedText})`,
  );
};

export const renderDirectiveListItemEntry = (
  declaration: ts.ClassDeclaration,
  ngChecker: TemplateTypeChecker,
) => {
  const owningModule = ngChecker.getOwningNgModule(declaration);
  const owningModuleName = owningModule
    ? (owningModule.name?.escapedText ?? "missing moudle name")
    : "standalone";

  return div(null, `- ${declaration.name?.escapedText} (${owningModuleName})`);
};
