import { IncomingMessage, Server, ServerResponse } from "http";
import ts from "typescript";
import { NgElementType } from "../types/ng-element.enum";
import { context } from "../main";
import { PotentialImportMode } from "../angular-tsc.helpers";
import {
  PotentialImport,
  Reference,
} from "@angular/compiler-cli/private/migrations";
import { ClassDeclaration } from "@angular/compiler-cli/src/ngtsc/reflection";

export const GET_module_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  res.writeHead(200, { "Content-Type": "text/json" });
  res.end(
    JSON.stringify(
      context.elements
        .map((element, id) => ({ ...element, id }))
        .filter((element) => element.type === NgElementType.NgModule)
        .map((component) => ({
          id: component.id,
          ...getComponent(component.cls),
        })),
    ),
  );
};

export const GET_component_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  res.writeHead(200, { "Content-Type": "text/json" });
  res.end(
    JSON.stringify(
      context.elements
        .map((element, id) => ({ ...element, id }))
        .filter((element) => element.type === NgElementType.Component)
        .map((component) => ({
          id: component.id,
          ...getComponent(component.cls),
        })),
    ),
  );
};

export const GET_directive_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  res.writeHead(200, { "Content-Type": "text/json" });
  res.end(
    JSON.stringify(
      context.elements
        .map((element, id) => ({ ...element, id }))
        .filter((element) => element.type === NgElementType.Directive)
        .map((component) => ({
          id: component.id,
          ...getDirective(component.cls),
        })),
    ),
  );
};

export const GET_component = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const [_0, _path, idString] = getPathnameElements(url);
  const id = Number(idString);
  const element = context.elements.at(id);

  if (!element) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("No element of that ID.");
    return;
  }

  if (element.type !== NgElementType.Component) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Element of ID ${id} is not a Component`);
    return;
  }

  res.writeHead(200, { "Content-Type": "text/json" });
  res.end(JSON.stringify({ id, ...getComponent(element.cls) }));
};

const getPipe = (cls: ts.ClassDeclaration) => {
  const meta = getPipeMetadata(cls);

  if (!meta) throw Error(`Element of is not a directive`);

  const owningModule = getOwningNgModule(cls);
  const declaredIn =
    owningModule &&
    context.elements.find((element) => element.cls === owningModule);

  return {
    type: NgElementType.Pipe,
    name: meta.name,
    className: cls.name?.escapedText,
    standalone: meta.isStandalone,
    declaredIn,
  };
};

const getPipeDep = (
  reference: Reference<ClassDeclaration>,
  opts?: { importIn?: ts.ClassDeclaration },
) => {
  const cls = reference.node as ts.ClassDeclaration;
  const meta = getPipeMetadata(cls);

  if (!meta) throw Error(`Element of is not a directive`);

  const owningModule = getOwningNgModule(cls);
  const declaredIn =
    owningModule &&
    context.elements.find((element) => element.cls === owningModule);

  let potentilImports: readonly PotentialImport[] | null = null;
  if (opts?.importIn) {
    potentilImports = context.checker.ng.getPotentialImportsFor(
      reference as Reference<ClassDeclaration>,
      opts.importIn,
      PotentialImportMode.Normal,
    );
  }

  return {
    type: NgElementType.Pipe,
    className: cls.name?.escapedText,
    declaredIn,
    name: meta.name,
    standalone: meta.isStandalone,
    ...(potentilImports ? { potentilImports } : {}),
  };
};

export const GET_component_dependency_list = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const [_api, _componenet, idString, _dependency] = getPathnameElements(url);
  const id = Number(idString);

  const element = context.elements.at(id);

  if (!element) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("No element of that ID.");
    return;
  }

  if (element.type !== NgElementType.Component) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Element of ID ${id} is not a Component`);
    return;
  }

  const potentialPipes = context.checker.ng.getPotentialPipes(element.cls);

  res.writeHead(200, { "Content-Type": "text/json" });
  res.end(
    JSON.stringify({
      directives:
        context.checker.ng
          .getUsedDirectives(element.cls)
          ?.map((directive) =>
            getDirective(directive.ref.node as ts.ClassDeclaration),
          ) ?? [],
      pipes:
        context.checker.ng.getUsedPipes(element.cls)?.map((name) => {
          const pipeUsed = potentialPipes.find(
            (potentialPipe) => potentialPipe.name === name,
          );
          if (!pipeUsed) return null;
          return getPipe(pipeUsed.ref.node as ts.ClassDeclaration);
        }) ?? [],
    }),
  );
};

export const GET_component_dependency = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const throwHttp = (code: number, message: string) => {
    res.writeHead(code, { "Content-Type": "text/plain" });
    res.end(message);
  };
  const throwNoElementOfId = (id: number) =>
    throwHttp(404, `No element with id: ${id}`);
  const throwElementIsNotOfType = (id: number, type: string) =>
    throwHttp(404, `Element of ID ${id} is not a ${type}`);

  const [_api, _componenetId, idString, _dependency, depIdString] =
    getPathnameElements(url);
  const componentId = Number(idString);
  const depId = Number(depIdString);

  const component = context.elements.at(componentId);
  const dep = context.elements.at(depId);

  if (!component) return throwNoElementOfId(componentId);

  if (component.type !== NgElementType.Component)
    return throwElementIsNotOfType(componentId, "Component");

  if (!dep) return throwNoElementOfId(depId);

  const templateDependencyTypes = [
    NgElementType.Component,
    NgElementType.Directive,
    NgElementType.Pipe,
  ];
  if (templateDependencyTypes.includes(dep.type))
    return throwElementIsNotOfType(
      componentId,
      templateDependencyTypes.join(", "),
    );

  res.writeHead(200, { "Content-Type": "text/json" });

  if (
    dep.type === NgElementType.Component ||
    dep.type === NgElementType.Directive
  ) {
    res.end(JSON.stringify(getDirective(dep.cls)));
  } else {
    res.end(JSON.stringify(getPipe(dep.cls)));
  }
};

const getPathnameElements = (url: URL): string[] => {
  return url.pathname.substring(1).split("/");
};

// local helpers
const getDirectiveMetadata = (cls: ts.ClassDeclaration) =>
  context.checker.ng.getDirectiveMetadata(cls);

const getPipeMetadata = (cls: ts.ClassDeclaration) =>
  context.checker.ng.getPipeMetadata(cls);

const getOwningNgModule = (cls: ts.ClassDeclaration) =>
  context.checker.ng.getOwningNgModule(cls);

const getDirective = (
  cls: ts.ClassDeclaration,
  opts?: { importIn: ts.ClassDeclaration },
) => {
  const meta = getDirectiveMetadata(cls);

  if (!meta) throw Error(`Element of is not a directive`);

  const owningModule = getOwningNgModule(cls);
  const declaredIn =
    owningModule &&
    context.elements.find((element) => element.cls === owningModule);

  // let potentilImports: readonly PotentialImport[] | null = null;
  // if (opts?.importIn) {
  //   potentilImports = context.checker.ng.getPotentialImportsFor(
  //     reference as Reference<ClassDeclaration>,
  //     opts.importIn,
  //     PotentialImportMode.Normal,
  //   );
  // }

  const directive = {
    name: cls.name?.escapedText,
    type: meta.isComponent ? NgElementType.Component : NgElementType.Directive,
    selector: meta?.selector,
    standalone: meta?.isStandalone,
    declaredIn: declaredIn?.cls.name?.escapedText,
  };

  console.log(directive);

  return directive;
};

// const getTemplateDependencies = (cls: ts.ClassDeclaration) => {
//   const usedDirectives =
//     context.checker.ng
//       .getUsedDirectives(cls)
//       ?.map((directive) =>
//         getDirective(directive.ref.node as ts.ClassDeclaration),
//       ) ?? [];
//
//   // const usedPipes =
//   //   context.checker.ng
//   //     .getUsedPipes(cls)
//   //     ?.map((pipe) =>
//   //       getPipe(directive.ref.node as ts.ClassDeclaration),
//   //     ) ?? [];
// };

const getComponent = (cls: ts.ClassDeclaration) => {
  const directive = getDirective(cls);

  if (directive.type !== NgElementType.Component)
    throw Error(`Element of is not a component`);

  return directive;
};
