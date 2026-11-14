import { ASTUtils, TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    max?: number;
  },
];
type MessageIds = 'tooLong';

const DEFAULT_MAX = 30;

/** Methods called as `method(path, ...handlers)`. */
const ROUTE_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'options',
  'patch',
  'query',
  'all',
]);

function getStaticString(node: TSESTree.Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? null;
  }
  return null;
}

/** Node types that can never be a Hono handler or a sub-app. */
const NON_HANDLER_TYPES = new Set<string>([
  'Literal',
  'TemplateLiteral',
  'ObjectExpression',
  'ArrayExpression',
]);

/** Strip TypeScript-only wrappers: `{ ... } as Config`, `{ ... } satisfies Config`. */
function unwrapTypeAssertions(node: TSESTree.Node): TSESTree.Node {
  let current = node;
  while (
    current.type === 'TSAsExpression'
    || current.type === 'TSSatisfiesExpression'
    || current.type === 'TSNonNullExpression'
    || current.type === 'TSTypeAssertion'
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * Split a route path into segments without breaking a `{regexp}` constraint
 * that itself contains a '/' (same approach as `no-duplicate-path-params`).
 */
function splitRoutingPath(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of path) {
    if (char === '{') depth++;
    else if (char === '}' && depth > 0) depth--;

    if (char === '/' && depth === 0) {
      segments.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  segments.push(current);

  return segments;
}

/**
 * Static segments of a path. Parameters (`:id`, `:id{[0-9]+}`, `:id?`) are
 * skipped: their names never appear in a request URL.
 */
function staticSegments(path: string): string[] {
  return splitRoutingPath(path).filter(segment => !segment.startsWith(':'));
}

export const maxPathNameLength = createRule<Options, MessageIds>({
  name: 'max-path-name-length',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a maximum length for each `/`-separated segment of a route path',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        'Route path segment \'{{segment}}\' in \'{{path}}\' is {{length}} characters long. The maximum allowed is {{max}}.',
    },
  },
  defaultOptions: [{ max: DEFAULT_MAX }],
  create(context, [options]) {
    const max = options.max ?? DEFAULT_MAX;

    /**
     * Whether an argument can be a Hono handler or a sub-app. Literals and
     * object literals cannot, which is what separates `app.get('/a', handler)`
     * from look-alikes such as `axios.get('/a', { params })` or
     * `map.set('k', 1)`. An identifier is followed to its declaration when it
     * is a `const` in this file. Anything that cannot be resolved (imports,
     * parameters, `let`) is assumed to be a handler.
     */
    function canBeHandler(node: TSESTree.CallExpressionArgument | undefined): boolean {
      if (!node) return false;
      const value = unwrapTypeAssertions(node);
      if (NON_HANDLER_TYPES.has(value.type)) return false;
      if (value.type !== 'Identifier') return true;

      const variable = ASTUtils.findVariable(context.sourceCode.getScope(value), value);
      if (!variable || variable.defs.length !== 1) return true;
      const def = variable.defs[0];
      if (
        def.type !== 'Variable'
        || def.parent.kind !== 'const'
        || def.node.id.type !== 'Identifier'
        || !def.node.init
      ) {
        return true;
      }
      return !NON_HANDLER_TYPES.has(unwrapTypeAssertions(def.node.init).type);
    }

    /** Report every static segment longer than `max`. */
    function check(node: TSESTree.Node) {
      const path = getStaticString(node);
      if (path === null) return;

      for (const segment of staticSegments(path)) {
        // Count code points so non-ASCII segments are not over-counted.
        const length = [...segment].length;
        if (length > max) {
          context.report({
            node,
            messageId: 'tooLong',
            data: { segment, path, length, max },
          });
        }
      }
    }

    /** A single path argument, or every element of a path array (`on()`). */
    function checkPathArg(node: TSESTree.CallExpressionArgument) {
      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          if (element && element.type !== 'SpreadElement') check(element);
        }
        return;
      }
      check(node);
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression'
          || callee.computed
          || callee.property.type !== 'Identifier'
        ) {
          return;
        }
        const name = callee.property.name;
        const args = node.arguments;

        // `get(path, ...handlers)`, and `route(path, subApp)`.
        if (ROUTE_METHODS.has(name) || name === 'route') {
          if (args.length >= 2 && getStaticString(args[0]) !== null && canBeHandler(args[1])) {
            check(args[0]);
          }
          return;
        }

        // `on(method | method[], path | path[], ...handlers)`.
        if (name === 'on') {
          if (args.length >= 3 && canBeHandler(args[2])) checkPathArg(args[1]);
          return;
        }

        // `basePath(path)`.
        if (name === 'basePath' && args.length === 1) {
          check(args[0]);
        }
      },
    };
  },
});
