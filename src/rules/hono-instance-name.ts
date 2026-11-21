import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    prefixes?: string[];
    suffixes?: string[];
  },
];
type MessageIds = 'missingPrefix' | 'missingSuffix' | 'noConvention';

/** Methods that return the Hono instance they are called on. */
const INSTANCE_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'options',
  'patch',
  'query',
  'all',
  'on',
  'use',
  'route',
  'mount',
  'onError',
  'notFound',
]);

/** Strip TypeScript-only wrappers: `x as Hono`, `x satisfies Hono`, `x!`, `<Hono>x`. */
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

/** `obj.name(...)` with a plain (non-computed) method name, or null. */
function getMethodCall(
  node: TSESTree.Node,
): { name: string; object: TSESTree.Expression } | null {
  if (
    node.type !== 'CallExpression'
    || node.callee.type !== 'MemberExpression'
    || node.callee.computed
    || node.callee.property.type !== 'Identifier'
  ) {
    return null;
  }
  return { name: node.callee.property.name, object: node.callee.object };
}

/**
 * Whether an initializer creates a new Hono instance: `new Hono()`, possibly
 * followed by methods that return the same instance (`new Hono().use(...)`).
 *
 * A chain that contains `basePath()` is left to `basepath-variable-name`,
 * which names the variable after its path, so it never counts here — even
 * when that rule skips the path (`/:tenant`, `/`, a dynamic path). Aliases
 * (`const b = a`) and chains on an existing variable (`app.get(...)`) do not
 * create an instance, so they do not count either.
 */
function isNewHonoInstance(init: TSESTree.Expression): boolean {
  let current = unwrapTypeAssertions(init);
  for (;;) {
    const call = getMethodCall(current);
    if (!call) break;
    if (!INSTANCE_METHODS.has(call.name)) return false;
    current = unwrapTypeAssertions(call.object);
  }
  return current.type === 'NewExpression'
    && current.callee.type === 'Identifier'
    && current.callee.name === 'Hono';
}

/**
 * Whether `name` starts with `prefix` at a word boundary: the name is the
 * prefix itself, the prefix ends in a separator (`app_`), or the next
 * character starts a new camelCase word (`apiUsers` for `api`, but not `apiary`).
 */
function hasPrefix(name: string, prefix: string): boolean {
  if (!name.startsWith(prefix)) return false;
  if (name.length === prefix.length) return true;
  if (!/[\p{L}\p{N}]$/u.test(prefix)) return true;
  return /^[\p{Lu}\p{N}_$]/u.test(name.slice(prefix.length));
}

function formatList(values: string[]): string {
  return values.map(value => `'${value}'`).join(', ');
}

export const honoInstanceName = createRule<Options, MessageIds>({
  name: 'hono-instance-name',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a naming convention (prefix and/or suffix) for variables holding a Hono instance',
    },
    schema: [
      {
        type: 'object',
        properties: {
          prefixes: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
          suffixes: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingPrefix:
        'Hono instance \'{{name}}\' should start with one of: {{prefixes}}.',
      missingSuffix:
        'Hono instance \'{{name}}\' should end with one of: {{suffixes}}.',
      noConvention:
        'hono/hono-instance-name is enabled, but neither \'prefixes\' nor \'suffixes\' is configured, so no naming convention is enforced.',
    },
  },
  defaultOptions: [{ prefixes: [], suffixes: [] }],
  create(context, [options]) {
    const prefixes = options.prefixes ?? [];
    const suffixes = options.suffixes ?? [];
    const hasConvention = prefixes.length > 0 || suffixes.length > 0;
    let reportedNoConvention = false;

    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !node.init) return;
        if (!isNewHonoInstance(node.init)) return;

        const name = node.id.name;

        if (!hasConvention) {
          // Once per file, on the first declaration the rule would check.
          if (!reportedNoConvention) {
            reportedNoConvention = true;
            context.report({ node: node.id, messageId: 'noConvention' });
          }
          return;
        }

        if (prefixes.length > 0 && !prefixes.some(prefix => hasPrefix(name, prefix))) {
          context.report({
            node: node.id,
            messageId: 'missingPrefix',
            data: { name, prefixes: formatList(prefixes) },
          });
        }
        if (suffixes.length > 0 && !suffixes.some(suffix => name.endsWith(suffix))) {
          context.report({
            node: node.id,
            messageId: 'missingSuffix',
            data: { name, suffixes: formatList(suffixes) },
          });
        }
      },
    };
  },
});
