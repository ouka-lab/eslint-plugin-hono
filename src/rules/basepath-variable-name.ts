import { ASTUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [
  {
    prefixes?: string[];
    suffixes?: string[];
  },
];
type MessageIds = 'mismatch';

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

/**
 * Words that cannot be used as a variable name in an ES module (strict mode),
 * so a base path such as `/delete` or `/new` has no matching variable name.
 */
const RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static',
  'implements', 'interface', 'package', 'private', 'protected', 'public',
  'arguments', 'eval',
]);

const IDENTIFIER_PATTERN = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

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

function upperFirst(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The variable name a base path asks for: every word of every segment joined
 * in camelCase (`/api/v1` → `apiV1`, `/user-profiles` → `userProfiles`).
 * An all-uppercase first word is lowercased as a whole (`/API` → `api`).
 * Null when the path has no such name: `/`, parameters, wildcards, regexps,
 * or a result that is not a valid variable name (`/2024`, `/delete`).
 */
function toExpectedName(path: string): string | null {
  const segments = path.split('/').filter(segment => segment !== '');
  if (segments.length === 0) return null;
  if (segments.some(segment => /[:*{}]/.test(segment))) return null;

  const words = segments
    .flatMap(segment => segment.split(/[^\p{L}\p{N}]+/u))
    .filter(word => word !== '');
  if (words.length === 0) return null;

  const [first, ...rest] = words;
  const head = first === first.toUpperCase()
    ? first.toLowerCase()
    : first.charAt(0).toLowerCase() + first.slice(1);
  const name = head + rest.map(upperFirst).join('');

  if (!IDENTIFIER_PATTERN.test(name) || RESERVED_WORDS.has(name)) return null;
  return name;
}

/**
 * The `basePath()` call whose result ends up in the variable, following
 * methods that return the same instance (`new Hono().basePath('/a').get(...)`).
 * When there are several, the last one wins, as it does at runtime.
 */
function findBasePathCall(init: TSESTree.Expression): TSESTree.CallExpression | null {
  let current = unwrapTypeAssertions(init);
  for (;;) {
    const call = getMethodCall(current);
    if (!call) return null;
    if (call.name === 'basePath') return current as TSESTree.CallExpression;
    if (!INSTANCE_METHODS.has(call.name)) return null;
    current = unwrapTypeAssertions(call.object);
  }
}

export const basepathVariableName = createRule<Options, MessageIds>({
  name: 'basepath-variable-name',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce that a variable holding a `basePath()` instance is named after its base path',
    },
    fixable: 'code',
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
      mismatch:
        'Variable \'{{name}}\' should be named \'{{expected}}\' to match basePath(\'{{path}}\').',
    },
  },
  defaultOptions: [{ prefixes: [], suffixes: [] }],
  create(context, [options]) {
    const prefixes = options.prefixes ?? [];
    const suffixes = options.suffixes ?? [];
    const sourceCode = context.sourceCode;

    /** The exact name plus every allowed prefix/suffix combination. */
    function allowedNames(expected: string): Set<string> {
      const names = new Set<string>();
      for (const prefix of ['', ...prefixes]) {
        const body = prefix === '' ? expected : prefix + upperFirst(expected);
        for (const suffix of ['', ...suffixes]) {
          names.add(body + suffix);
        }
      }
      return names;
    }

    /**
     * Whether an expression is certainly a Hono instance: `new Hono()`, a
     * method that returns the instance, or a `const`-like variable in this
     * file whose initializer is one of those. Imports, parameters and
     * reassigned variables cannot be followed, so they are not.
     */
    function isHonoInstance(node: TSESTree.Node, seen: Set<TSESLint.Scope.Variable>): boolean {
      const value = unwrapTypeAssertions(node);

      if (value.type === 'NewExpression') {
        return value.callee.type === 'Identifier' && value.callee.name === 'Hono';
      }

      const call = getMethodCall(value);
      if (call) {
        if (!INSTANCE_METHODS.has(call.name) && call.name !== 'basePath') return false;
        return isHonoInstance(call.object, seen);
      }

      if (value.type !== 'Identifier') return false;

      const variable = ASTUtils.findVariable(sourceCode.getScope(value), value);
      if (!variable || seen.has(variable) || variable.defs.length !== 1) return false;
      const def = variable.defs[0];
      if (def.type !== 'Variable' || def.node.id.type !== 'Identifier' || !def.node.init) {
        return false;
      }
      const declaredId = def.node.id;
      const reassigned = variable.references.some(
        reference => reference.isWrite() && reference.identifier !== declaredId,
      );
      if (reassigned) return false;

      seen.add(variable);
      return isHonoInstance(def.node.init, seen);
    }

    /**
     * Rename the declaration and every reference, or null when that is not
     * safe: an exported name is public API, and an existing `expected`
     * binding (or an undeclared global of that name) would be captured.
     */
    function buildFix(
      declarator: TSESTree.VariableDeclarator,
      id: TSESTree.Identifier,
      expected: string,
    ): TSESLint.ReportFixFunction | null {
      const variable = sourceCode.getDeclaredVariables(declarator)
        .find(candidate => candidate.name === id.name);
      if (!variable) return null;

      if (declarator.parent.parent?.type === 'ExportNamedDeclaration') return null;
      if (variable.references.some(reference => reference.identifier.parent?.type === 'ExportSpecifier')) {
        return null;
      }

      const scopes = new Set([variable.scope, ...variable.references.map(reference => reference.from)]);
      for (const scope of scopes) {
        if (ASTUtils.findVariable(scope, expected)) return null;
      }
      const globalScope = sourceCode.scopeManager?.globalScope;
      if (globalScope?.through.some(reference => reference.identifier.name === expected)) {
        return null;
      }

      const identifiers = new Set<TSESTree.Identifier | TSESTree.JSXIdentifier>([
        id,
        ...variable.references.map(reference => reference.identifier),
      ]);

      return (fixer) => {
        const fixes: TSESLint.RuleFix[] = [];
        for (const identifier of identifiers) {
          // Only the name itself: a declared identifier's range also covers
          // its type annotation (`const app: Hono = ...`).
          const range: TSESTree.Range = [
            identifier.range[0],
            identifier.range[0] + identifier.name.length,
          ];
          const parent = identifier.parent;
          const shorthand = parent?.type === 'Property' && parent.shorthand && parent.value === identifier;
          // `{ app }` keeps its key: `{ app: api }`.
          fixes.push(fixer.replaceTextRange(range, shorthand ? `${identifier.name}: ${expected}` : expected));
        }
        return fixes;
      };
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !node.init) return;

        const basePathCall = findBasePathCall(node.init);
        if (!basePathCall || basePathCall.arguments.length !== 1) return;

        const receiver = getMethodCall(basePathCall)!.object;
        if (!isHonoInstance(receiver, new Set())) return;

        const path = getStaticString(basePathCall.arguments[0]);
        if (path === null) return;
        const expected = toExpectedName(path);
        if (expected === null) return;

        const name = node.id.name;
        if (allowedNames(expected).has(name)) return;

        context.report({
          node: node.id,
          messageId: 'mismatch',
          data: { name, expected, path },
          fix: buildFix(node, node.id, expected),
        });
      },
    };
  },
});
