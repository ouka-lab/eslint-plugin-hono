import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    order: string[];
  },
];

const DEFAULT_ORDER = [
  'use',
  'all',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'on',
];

type RouteDefinition = {
  instance: string | null;
  path: string;
  methods: { name: string; node: TSESTree.MemberExpression }[];
  statement: TSESTree.Statement;
};

export const routeGrouping = createRule<
  Options,
  'routeGroup' | 'methodOrder' | 'instanceGroup'
>({
  name: 'route-grouping',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce grouping and ordering of routes by HTTP method and Hono instance',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
            description: 'Specifies the desired order of HTTP methods.',
            default: DEFAULT_ORDER,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      routeGroup:
        'Routes for path \'{{path}}\' on instance \'{{instance}}\' should be grouped together.',
      methodOrder:
        'Method \'{{method}}\' should be before \'{{prevMethod}}\' for path \'{{path}}\'.',
      instanceGroup:
        'All routes for \'{{instance}}\' should be defined together before defining routes for another instance.',
    },
  },
  defaultOptions: [
    {
      order: DEFAULT_ORDER,
    },
  ],
  create(context) {
    const order = context.options[0]?.order || DEFAULT_ORDER;

    function getRootIdentifierName(
      node: TSESTree.MemberExpression,
    ): string | null {
      let current = node.object;
      while (current.type === 'MemberExpression') {
        current = current.object;
      }
      if (current.type === 'Identifier') {
        return current.name;
      }
      return null;
    }

    function getMethodChain(
      node: TSESTree.CallExpression,
    ): { name: string; node: TSESTree.MemberExpression }[] {
      const methods: { name: string; node: TSESTree.MemberExpression }[] = [];
      let current: TSESTree.Expression | TSESTree.Super = node;

      while (current.type === 'CallExpression') {
        if (
          current.callee.type === 'MemberExpression'
          && current.callee.property.type === 'Identifier'
        ) {
          const methodName = current.callee.property.name;
          if (order.includes(methodName)) {
            methods.unshift({
              name: methodName,
              node: current.callee,
            });
          }
        }
        if (current.callee.type === 'MemberExpression') {
          current = current.callee.object;
        }
        else {
          break;
        }
      }
      return methods;
    }

    function getRoutePath(node: TSESTree.CallExpression): string | null {
      const stack: TSESTree.CallExpression[] = [];
      let temp: TSESTree.Expression | TSESTree.Super = node;
      while (temp.type === 'CallExpression') {
        stack.push(temp);
        if (temp.callee.type === 'MemberExpression') {
          temp = temp.callee.object;
        }
        else {
          break;
        }
      }

      while (stack.length > 0) {
        const call = stack.pop()!;
        if (
          call.callee.type === 'MemberExpression'
          && call.callee.property.type === 'Identifier'
          && order.includes(call.callee.property.name)
        ) {
          if (call.arguments.length > 0 && call.arguments[0].type === 'Literal') {
            return String(call.arguments[0].value);
          }
        }
      }

      return null;
    }

    function checkBlock(node: TSESTree.BlockStatement | TSESTree.Program) {
      const routes: RouteDefinition[] = [];
      const honoInstances = new Set<string>();

      for (const statement of node.body) {
        if (statement.type === 'VariableDeclaration') {
          for (const decl of statement.declarations) {
            if (
              decl.init
              && decl.init.type === 'NewExpression'
              && decl.init.callee.type === 'Identifier'
              && decl.init.callee.name === 'Hono'
              && decl.id.type === 'Identifier'
            ) {
              honoInstances.add(decl.id.name);
            }
          }
        }

        if (
          statement.type !== 'ExpressionStatement'
          || statement.expression.type !== 'CallExpression'
        ) {
          continue;
        }

        const callExpr = statement.expression;
        if (callExpr.callee.type !== 'MemberExpression') {
          continue;
        }
        const instanceName = getRootIdentifierName(callExpr.callee);
        if (!instanceName || !honoInstances.has(instanceName)) {
          continue;
        }

        const methods = getMethodChain(callExpr);
        if (methods.length === 0) {
          continue;
        }

        const path = getRoutePath(callExpr);
        if (path === null) {
          continue;
        }

        routes.push({
          instance: instanceName,
          path,
          methods,
          statement,
        });
      }

      const instanceStates = new Map<
        string,
        { seenPaths: Set<string>; lastPath: string | null }
      >();
      const pathMethods = new Map<
        string,
        { name: string; node: TSESTree.MemberExpression }[]
      >();
      let activeInstance: string | null = null;
      const finishedInstances = new Set<string>();

      for (const route of routes) {
        if (!route.instance) continue;

        if (activeInstance !== route.instance) {
          if (finishedInstances.has(route.instance)) {
            context.report({
              node: route.methods[0].node,
              messageId: 'instanceGroup',
              data: { instance: route.instance },
            });
          }
          if (activeInstance) {
            finishedInstances.add(activeInstance);
          }
          activeInstance = route.instance;
        }

        if (!instanceStates.has(route.instance)) {
          instanceStates.set(route.instance, {
            seenPaths: new Set(),
            lastPath: null,
          });
        }
        const state = instanceStates.get(route.instance)!;

        if (route.path !== state.lastPath) {
          if (state.seenPaths.has(route.path)) {
            context.report({
              node: route.methods[0].node,
              messageId: 'routeGroup',
              data: {
                path: route.path,
                instance: route.instance,
              },
            });
          }
          state.seenPaths.add(route.path);
          state.lastPath = route.path;
        }

        const pathKey = JSON.stringify({
          instance: route.instance,
          path: route.path,
        });
        if (!pathMethods.has(pathKey)) {
          pathMethods.set(pathKey, []);
        }
        pathMethods.get(pathKey)!.push(...route.methods);
      }

      for (const [pathKey, methods] of pathMethods.entries()) {
        const { path } = JSON.parse(pathKey);
        for (let i = 0; i < methods.length - 1; i++) {
          const current = methods[i];
          const next = methods[i + 1];
          const currentIndex = order.indexOf(current.name);
          const nextIndex = order.indexOf(next.name);

          if (currentIndex > nextIndex) {
            context.report({
              node: next.node,
              messageId: 'methodOrder',
              data: {
                method: next.name,
                prevMethod: current.name,
                path,
              },
            });
          }
        }
      }
    }

    return {
      Program: checkBlock,
      BlockStatement: checkBlock,
    };
  },
});
