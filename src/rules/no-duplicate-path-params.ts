import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [];
type MessageIds = 'duplicateParam';

/**
 * Methods that take a route path, mapped to the index of the path argument.
 * `on()` is the odd one out: its first argument is the HTTP method.
 */
const PATH_ARG_INDEX: Record<string, number> = {
  get: 0,
  post: 0,
  put: 0,
  patch: 0,
  delete: 0,
  options: 0,
  all: 0,
  use: 0,
  route: 0,
  mount: 0,
  basePath: 0,
  on: 1,
};

/**
 * Hono's own parameter grammar (`getPattern` in `hono/utils/url`): a parameter
 * takes a whole path segment, and its name is anything but braces, followed by
 * an optional `{regexp}` constraint.
 *
 * Matching this exactly matters. Hono really does capture `/u/:user-id` as
 * `user-id` and `/u/:a.b` as `a.b`, so a name cut short at the first non-word
 * character would turn two distinct parameters into a false duplicate.
 */
const PARAM_SEGMENT = /^:([^{}]+)(?:\{.+\})?$/;

/**
 * Split a route path into segments the way Hono does, without breaking a
 * `{regexp}` constraint that itself contains a '/'.
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
 * Collect the `:name` parameters declared in a Hono route path.
 *
 * This mirrors Hono's grammar rather than approximating it, because a name the
 * scanner truncates turns two distinct parameters into a false duplicate.
 */
function extractPathParams(path: string): string[] {
  const params: string[] = [];

  for (const segment of splitRoutingPath(path)) {
    const match = PARAM_SEGMENT.exec(segment);
    if (!match) continue;
    // `/posts/:id?` captures the key as `id`, so the optional marker is not
    // part of the name.
    params.push(match[1].replace(/\?$/, ''));
  }

  return params;
}

/** A route path is always a string that starts with '/'. */
function getRoutePath(node: TSESTree.Node): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.startsWith('/') ? node.value : null;
  }

  if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
    // `cooked` is null when the template holds an invalid escape sequence.
    const cooked = node.quasis[0].value.cooked;
    return cooked && cooked.startsWith('/') ? cooked : null;
  }

  return null;
}

export const noDuplicatePathParams = createRule<Options, MessageIds>({
  name: 'no-duplicate-path-params',
  meta: {
    type: 'problem',
    docs: {
      description:
                'Disallow declaring the same path parameter name twice in a route path',
    },
    schema: [],
    messages: {
      duplicateParam:
                'Route path \'{{routePath}}\' declares \':{{paramName}}\' more than once. Give each path parameter a unique name.',
    },
  },
  defaultOptions: [],
  create(context) {
    function checkPathNode(node: TSESTree.Node) {
      const routePath = getRoutePath(node);
      if (routePath === null) return;

      const seen = new Set<string>();
      const reported = new Set<string>();

      for (const name of extractPathParams(routePath)) {
        if (!seen.has(name)) {
          seen.add(name);
          continue;
        }
        if (reported.has(name)) continue;
        reported.add(name);

        context.report({
          node,
          messageId: 'duplicateParam',
          data: { routePath, paramName: name },
        });
      }
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression'
          || node.callee.property.type !== 'Identifier'
        )
          return;

        const index = PATH_ARG_INDEX[node.callee.property.name];
        if (index === undefined) return;

        const pathArg = node.arguments[index];
        if (!pathArg) return;

        if (pathArg.type === 'ArrayExpression') {
          for (const element of pathArg.elements) {
            if (element) checkPathNode(element);
          }
          return;
        }

        checkPathNode(pathArg);
      },
    };
  },
});
