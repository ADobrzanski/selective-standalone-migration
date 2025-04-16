import { IncomingMessage, Server, ServerResponse } from "http";
import ts from "typescript";
import { NgElementType } from "../types/ng-element.enum";
import { context } from "../main";
import { NamedClassDeclaration } from "../angular-tsc.helpers";

const respond = (res: ServerResponse<IncomingMessage>) => {
  return {
    with(opts: { data: unknown; code: number }): void {
      if (typeof opts.data === "string") {
        res.writeHead(opts.code, { "Content-Type": "text/plain" });
        res.end(opts.data);
      } else {
        res.writeHead(opts.code, { "Content-Type": "text/json" });
        res.end(JSON.stringify(opts.data));
      }
    },
    ok(data: unknown): void {
      return this.with({ data, code: 200 });
    },
    notFoundId(id: number): void {
      return this.with({
        data: { details: `No element with ID equal ${id}.` },
        code: 404,
      });
    },
    notOfType(opts: { id: number; type: NgElementType | string }): void {
      return this.with({
        code: 404,
        data: {
          details: `Element with ID equal ${opts.id} is not ${opts.type}.`,
        },
      });
    },
  };
};

export const GET_module_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const moduleList = context.elements
    .map((element, id) => ({ ...element, id }))
    .filter((element) => element.type === NgElementType.NgModule)
    .map((component) => getComponent(component.cls));

  respond(res).ok(moduleList);
};

export const GET_component_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const componentList = context.elements
    .map((element, id) => ({ ...element, id }))
    .filter((element) => element.type === NgElementType.Component)
    .map((component) => getComponent(component.cls));

  respond(res).ok(componentList);
};

export const GET_directive_list = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const directiveList = context.elements
    .map((element, id) => ({ ...element, id }))
    .filter((element) => element.type === NgElementType.Directive)
    .map((component) => getDirective(component.cls));

  respond(res).ok(directiveList);
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
    respond(res).notFoundId(id);
    return;
  }

  if (element.type !== NgElementType.Component) {
    respond(res).notOfType({ id, type: NgElementType.Component });
    return;
  }

  respond(res).ok(getComponent(element.cls));
};

const getPipe = (cls: ts.ClassDeclaration) => {
  const meta = getPipeMetadata(cls);

  if (!meta) throw Error(`Element of is not a directive`);

  const owningModule = getOwningNgModule(cls);

  return {
    id: context.elements.findIndex((el) => el.cls === cls),
    type: NgElementType.Pipe,
    name: meta.name,
    className: cls.name?.escapedText,
    standalone: meta.isStandalone,
    declaredIn: owningModule && getModule(owningModule),
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
    return respond(res).notFoundId(id);
  }

  if (element.type !== NgElementType.Component) {
    return respond(res).notOfType({ id, type: NgElementType.Component });
  }

  const dependencies = element
    .dependencies()
    .map((dep) => {
      const depCls = dep.node as ts.ClassDeclaration;
      try {
        return getDirective(depCls);
      } catch (e) {
        /* ignore */
      }
      try {
        return getPipe(depCls);
      } catch (e) {
        /* ignore */
      }
      return null;
    })
    .filter(Boolean);

  respond(res).ok(dependencies);
};

export const GET_component_consumer_list = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const [_api, _componenet, idString, _consumer] = getPathnameElements(url);
  const id = Number(idString);

  const element = context.elements.at(id);

  if (!element) {
    respond(res).notFoundId(id);
    return;
  }

  if (element.type !== NgElementType.Component) {
    respond(res).notOfType({ id, type: NgElementType.Component });
    return;
  }

  const directConsumers = context.elements
    .filter((el) => el.type === NgElementType.Component)
    .filter((cp, index, array) => {
      console.log(
        `(${index}/${array.length}) analysing ${cp.cls.name?.escapedText}`,
      );
      const dependencies = cp.dependencies();

      const hit = dependencies
        .map((dep) => dep.node)
        .includes(element.cls as NamedClassDeclaration);

      if (hit)
        console.log(
          `(${index}/${array.length}) ${cp.cls.name?.escapedText} is a HIT!`,
        );

      return hit;
    });

  respond(res).ok(
    directConsumers.map((consumer) => {
      switch (consumer.type) {
        case NgElementType.Pipe:
          return getPipe(consumer.cls);
        case NgElementType.Component:
          return getComponent(consumer.cls);
        case NgElementType.Directive:
          return getDirective(consumer.cls);
        case NgElementType.NgModule:
          // Should not happen really
          return getModule(consumer.cls);
      }
    }),
  );
};

export const GET_component_dependency = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
) => {
  const [_api, _componenetId, idString, _dependency, depIdString] =
    getPathnameElements(url);
  const componentId = Number(idString);
  const depId = Number(depIdString);

  const component = context.elements.at(componentId);
  const dep = context.elements.at(depId);

  if (!component) return respond(res).notFoundId(componentId);

  if (component.type !== NgElementType.Component)
    return respond(res).notOfType({
      id: componentId,
      type: NgElementType.Component,
    });

  if (!dep) return respond(res).notFoundId(depId);

  const templateDependencyTypes = [
    NgElementType.Component,
    NgElementType.Directive,
    NgElementType.Pipe,
  ];
  if (templateDependencyTypes.includes(dep.type))
    return respond(res).notOfType({
      id: depId,
      type: templateDependencyTypes.join(", "),
    });

  if (
    dep.type === NgElementType.Component ||
    dep.type === NgElementType.Directive
  ) {
    respond(res).ok(getDirective(dep.cls));
  } else {
    respond(res).ok(getPipe(dep.cls));
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

const getDirective = (cls: ts.ClassDeclaration) => {
  const meta = getDirectiveMetadata(cls);

  if (!meta) throw Error(`Element of is not a directive`);

  const owningModule = getOwningNgModule(cls);
  const declaredIn =
    owningModule &&
    context.elements.find((element) => element.cls === owningModule);

  const directive = {
    id: context.elements.findIndex((el) => el.cls === cls),
    name: cls.name?.escapedText,
    type: meta.isComponent ? NgElementType.Component : NgElementType.Directive,
    selector: meta?.selector,
    standalone: meta?.isStandalone,
    declaredIn: declaredIn?.cls && getModule(declaredIn.cls),
  };

  return directive;
};

const getComponent = (cls: ts.ClassDeclaration) => {
  const directive = getDirective(cls);

  if (directive.type !== NgElementType.Component)
    throw Error(`Element of is not a component`);

  return directive;
};

const getModule = (cls: ts.ClassDeclaration) => {
  const meta = context.checker.ng.getNgModuleMetadata(cls);

  if (!meta) throw Error(`Element "${cls.name?.escapedText}" is not a module.`);

  const module = {
    id: context.elements.findIndex((el) => el.cls === cls),
    name: cls.name?.escapedText,
    type: NgElementType.NgModule,
  };

  return module;
};
