import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    mustMatch?: string;
    mustNotMatch?: string;
    disallowedWords?: string[];
  },
];
type MessageIds = 'disallowedWord' | 'mustNotMatch' | 'mustMatch';

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

/**
 * Whether an argument can be a Hono handler or a sub-app. Literals and object
 * literals cannot, which is what separates `app.get('/a', handler)` from
 * look-alikes such as `axios.get('/a', { params })` or `map.set('k', 1)`.
 */
function canBeHandler(node: TSESTree.CallExpressionArgument | undefined): boolean {
  if (!node) return false;
  return !(
    node.type === 'Literal'
    || node.type === 'TemplateLiteral'
    || node.type === 'ObjectExpression'
    || node.type === 'ArrayExpression'
  );
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
 * Lower-cased words of a piece of text, split on anything that is not a letter
 * or digit and on camelCase boundaries: `getUserById` and `get-user_by.id`
 * both become `['get', 'user', 'by', 'id']`.
 */
function toWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(word => word !== '')
    .map(word => word.toLowerCase());
}

/**
 * The words of each static segment. Parameters (`:id`, `:id{[0-9]+}`) and
 * wildcards are skipped: their names never appear in a request URL.
 */
function segmentWords(path: string): string[][] {
  return splitRoutingPath(path)
    .filter(segment => !segment.startsWith(':'))
    .map(toWords)
    .filter(words => words.length > 0);
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((word, j) => haystack[i + j] === word)) return true;
  }
  return false;
}

export const validRoutePath = createRule<Options, MessageIds>({
  name: 'valid-route-path',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce naming conventions on route paths with patterns and disallowed words',
    },
    schema: [
      {
        type: 'object',
        properties: {
          mustMatch: { type: 'string' },
          mustNotMatch: { type: 'string' },
          disallowedWords: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      disallowedWord:
        'Route path \'{{path}}\' contains the disallowed word \'{{word}}\'.',
      mustNotMatch:
        'Route path \'{{path}}\' must not match the pattern \'{{pattern}}\'.',
      mustMatch:
        'Route path \'{{path}}\' must match the pattern \'{{pattern}}\'.',
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const mustMatch
      = options.mustMatch === undefined ? null : new RegExp(options.mustMatch, 'u');
    const mustNotMatch
      = options.mustNotMatch === undefined ? null : new RegExp(options.mustNotMatch, 'u');
    const disallowedWords = (options.disallowedWords ?? [])
      .map(word => ({ word, words: toWords(word) }))
      .filter(entry => entry.words.length > 0);

    if (!mustMatch && !mustNotMatch && disallowedWords.length === 0) return {};

    /**
     * Report the strongest violation only. The options are ranked
     * `disallowedWords` > `mustNotMatch` > `mustMatch`: a path that satisfies
     * `mustMatch` is still reported for a disallowed word or a `mustNotMatch`
     * hit, and a path is never reported twice.
     */
    function check(node: TSESTree.Node) {
      const path = getStaticString(node);
      if (path === null) return;

      const segments = segmentWords(path);
      for (const { word, words } of disallowedWords) {
        if (segments.some(segment => containsSequence(segment, words))) {
          context.report({ node, messageId: 'disallowedWord', data: { path, word } });
          return;
        }
      }

      if (mustNotMatch?.test(path)) {
        context.report({
          node,
          messageId: 'mustNotMatch',
          data: { path, pattern: options.mustNotMatch },
        });
        return;
      }

      if (mustMatch && !mustMatch.test(path)) {
        context.report({
          node,
          messageId: 'mustMatch',
          data: { path, pattern: options.mustMatch },
        });
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
