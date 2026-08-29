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
  basePath: 0,
  on: 1,
};

const NAME_CHAR = /[a-zA-Z0-9_]/;

/**
 * Collect the `:name` parameters declared in a Hono route path.
 *
 * Scanning character by character rather than with a single regex is what
 * makes `:date{\d{4}}` work: the braces of a regexp constraint nest, so the
 * constraint has to be skipped by counting them.
 */
function extractPathParams(path: string): string[] {
  const params: string[] = [];
  let i = 0;

  while (i < path.length) {
    if (path[i] !== ':') {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < path.length && NAME_CHAR.test(path[j])) j++;

    if (j === i + 1) {
      // A bare ':' with no name — not a parameter.
      i++;
      continue;
    }

    params.push(path.slice(i + 1, j));

    if (path[j] === '{') {
      let depth = 0;
      while (j < path.length) {
        const char = path[j];
        if (char === '\\') {
          j += 2;
          continue;
        }
        if (char === '{') {
          depth++;
        }
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }
    }

    if (path[j] === '?') j++;

    i = j;
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
