import { ASTUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    max?: number;
  },
];
type MessageIds = 'tooManyReturns';

const DEFAULT_MAX = 5;

const { DefinitionType } = TSESLint.Scope;

const ROUTE_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'all',
  'on',
]);

type FunctionNode
  = | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
    | TSESTree.FunctionDeclaration;

export const maxReturn = createRule<Options, MessageIds>({
  name: 'max-return',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a maximum number of return statements in a single route handler',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyReturns:
        'Route handler has too many return statements ({{count}}). Maximum allowed is {{max}}.',
    },
  },
  defaultOptions: [{ max: DEFAULT_MAX }],
  create(context, [options]) {
    const max = options.max ?? DEFAULT_MAX;
    const sourceCode = context.sourceCode;

    /** `return` count per function, for every function in the file. */
    const returnCounts = new Map<FunctionNode, number>();
    /** Every function currently being traversed, innermost last. */
    const functionStack: FunctionNode[] = [];
    /** Functions known to be used as route handlers. */
    const handlers = new Set<FunctionNode>();

    function isFunctionNode(node: TSESTree.Node | null | undefined): node is FunctionNode {
      return (
        node?.type === 'ArrowFunctionExpression'
        || node?.type === 'FunctionExpression'
        || node?.type === 'FunctionDeclaration'
      );
    }

    function isRouteMethodCall(node: TSESTree.CallExpression): boolean {
      const callee = node.callee;
      return (
        callee.type === 'MemberExpression'
        && !callee.computed
        && callee.property.type === 'Identifier'
        && ROUTE_METHODS.has(callee.property.name)
      );
    }

    /**
     * Resolve an identifier passed as a handler (`app.get('/', handler)`) to
     * the function it names. Only `function handler() {}` and
     * `const handler = () => {}` / `function () {}` are followed: a `let` or
     * `var` may be reassigned, and imports or parameters cannot be inspected.
     */
    function resolveHandler(node: TSESTree.Identifier): FunctionNode | null {
      const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
      if (!variable || variable.defs.length !== 1) return null;
      const def = variable.defs[0];
      if (def.type === DefinitionType.FunctionName) {
        return isFunctionNode(def.node) ? def.node : null;
      }
      if (
        def.type === DefinitionType.Variable
        && def.parent.kind === 'const'
        && def.node.id.type === 'Identifier'
        && isFunctionNode(def.node.init)
      ) {
        return def.node.init;
      }
      return null;
    }

    function enterFunction(node: FunctionNode) {
      functionStack.push(node);
      returnCounts.set(node, 0);
    }

    function exitFunction() {
      functionStack.pop();
    }

    return {
      'ArrowFunctionExpression': enterFunction,
      'FunctionExpression': enterFunction,
      'FunctionDeclaration': enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      'FunctionExpression:exit': exitFunction,
      'FunctionDeclaration:exit': exitFunction,
      ReturnStatement() {
        // Attribute each return to its innermost function only, so returns
        // inside nested callbacks or helpers never count toward a handler.
        const owner = functionStack[functionStack.length - 1];
        if (owner) returnCounts.set(owner, (returnCounts.get(owner) ?? 0) + 1);
      },
      CallExpression(node) {
        if (!isRouteMethodCall(node)) return;
        for (const arg of node.arguments) {
          if (isFunctionNode(arg)) {
            handlers.add(arg);
          }
          else if (arg.type === 'Identifier') {
            const fn = resolveHandler(arg);
            if (fn) handlers.add(fn);
          }
        }
      },
      // Handlers are usually defined before the route that uses them, so
      // the verdict waits until every function and route has been seen.
      'Program:exit'() {
        for (const handler of handlers) {
          const count = returnCounts.get(handler) ?? 0;
          if (count <= max) continue;
          context.report({
            node: handler,
            // Highlight only the handler's head (`(c) =>` / `function h(c)`),
            // not the whole body.
            loc: { start: handler.loc.start, end: handler.body.loc.start },
            messageId: 'tooManyReturns',
            data: { count, max },
          });
        }
      },
    };
  },
});
