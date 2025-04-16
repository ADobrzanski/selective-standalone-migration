import ts from "typescript";
import { NgElementType } from "../types/ng-element.enum";
import { context } from "../main";
import { NamedClassDeclaration } from "../angular-tsc.helpers";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { FastifyPluginAsync } from "fastify";
import { noElementWithId, notOfType } from "./api-responses";

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

const apiRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) => {
  fastify.get("/module", async (_request, _reply) => {
    const moduleList = context.elements
      .map((element, id) => ({ ...element, id }))
      .filter((element) => element.type === NgElementType.NgModule)
      .map((component) => getModule(component.cls));

    return moduleList;
  });

  fastify.get("/component", async (_request, _reply) => {
    const componentList = context.elements
      .map((element, id) => ({ ...element, id }))
      .filter((element) => element.type === NgElementType.Component)
      .map((component) => getComponent(component.cls));

    return componentList;
  });

  fastify.get("/component/:id", async (request, reply) => {
    const id = Number((request.params as Record<string, string>).id);
    const element = context.elements.at(id);

    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }

    if (element.type !== NgElementType.Component) {
      reply.status(404).send(notOfType({ id, type: NgElementType.Component }));
      return;
    }

    return getComponent(element.cls);
  });

  fastify.get("/component/:id/dependency", async (request, reply) => {
    const id = Number((request.params as Record<string, string>).id);
    const element = context.elements.at(id);

    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }

    if (element.type !== NgElementType.Component) {
      reply.status(404).send(notOfType({ id, type: NgElementType.Component }));
      return;
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

    return dependencies;
  });

  fastify.get(
    "/component/:id/dependency/:dependencyId",
    async (request, reply) => {
      const params = request.params as Record<string, string>;

      const componentId = Number(params.id);
      const depId = Number(params.dependencyId);

      const component = context.elements.at(componentId);
      const dep = context.elements.at(depId);

      if (!component) {
        reply.status(404).send(noElementWithId(componentId));
        return;
      }

      if (component.type !== NgElementType.Component) {
        reply
          .status(400)
          .send(notOfType({ id: componentId, type: NgElementType.Component }));
        return;
      }

      if (!dep) {
        reply.status(404).send(noElementWithId(depId));
        return;
      }

      const templateDependencyTypes = [
        NgElementType.Component,
        NgElementType.Directive,
        NgElementType.Pipe,
      ];
      if (!templateDependencyTypes.includes(dep.type)) {
        reply
          .status(400)
          .send(
            notOfType({ id: depId, type: templateDependencyTypes.join(", ") }),
          );
        return;
      }

      if (
        dep.type === NgElementType.Component ||
        dep.type === NgElementType.Directive
      ) {
        return getDirective(dep.cls);
      } else {
        return getPipe(dep.cls);
      }
    },
  );

  fastify.get("/component/:id/consumer", async (request, reply) => {
    const id = Number((request.params as Record<string, string>).id);
    const element = context.elements.at(id);

    if (!element) {
      reply.status(404).send(noElementWithId(id));
      return;
    }

    if (element.type !== NgElementType.Component) {
      reply.status(404).send(notOfType({ id, type: NgElementType.Component }));
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

    return directConsumers.map((consumer) => {
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
    });
  });

  fastify.get("/directive", async (_request, _reply) => {
    const directiveList = context.elements
      .map((element, id) => ({ ...element, id }))
      .filter((element) => element.type === NgElementType.Directive)
      .map((component) => getDirective(component.cls));

    return directiveList;
  });
};

export default apiRoutes;
