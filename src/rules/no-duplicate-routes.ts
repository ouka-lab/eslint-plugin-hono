import { ASTUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [];
type MessageIds = 'duplicateRoute' | 'shadowedByAll' | 'duplicateMountedRoute';

/** Hono's `METHOD_NAME_ALL`: what `app.all()` registers under. */
const METHOD_ALL = 'ALL';

/** `get`, `post`, ... and `all`: methods whose first argument is an optional path. */
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

/** Methods other than the route methods that return the same instance. */
const CHAINABLE_METHODS = new Set(['on', 'use', 'route', 'mount', 'onError', 'notFound']);

/**
 * Parents a route call may sit under and still be certain to run, exactly
 * once, in source order. Anything else (`if`, `?:`, `&&`, loops, `try`, a
 * nested block or function) means the call may run zero or many times.
 */
const UNCONDITIONAL_PARENTS = new Set<string>([
  'CallExpression',
  'MemberExpression',
  'ExpressionStatement',
  'VariableDeclarator',
  'VariableDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'AwaitExpression',
  'ChainExpression',
]);

type RouteEntry = {
  method: string;
  /** Full path as Hono stores it in `app.routes` (base path already merged). */
  path: string;
  line: number;
  /** An inline handler takes `next`, so it may hand the request on. */
  middlewareLike: boolean;
};

/**
 * One `routes` array. `basePath()` clones share it with the instance they came
 * from, so every instance derived from one `new Hono()` writes into one table.
 */
type RouteTable = {
  strict: boolean;
  entries: RouteEntry[];
  /** The block (or arrow body) the `new Hono()` was evaluated in. */
  home: TSESTree.Node;
};

type InstanceRef = {
  table: RouteTable;
  /** `_basePath`, or null when it is not statically known. */
  prefix: string | null;
  /**
   * Hono's private `#path`: the last path given to a route method, reused by
   * a later call that omits it. Null when it is not statically known.
   */
  path: string | null;
  /** Methods the last call registered on `path`, so `.get(a).get(b)` is one route. */
  lastMethods: Set<string>;
};

/**
 * Port of Hono's `mergePath` (`hono/utils/url`), so base paths and `route()`
 * prefixes join exactly the way Hono joins them (`/book` + `/` is `/book`).
 */
function mergePath(base: string, sub: string): string {
  const lead = base[0] === '/' ? '' : '/';
  if (sub === '/') return `${lead}${base}`;
  const sep = base[base.length - 1] === '/' ? '' : '/';
  return `${lead}${base}${sep}${sub[0] === '/' ? sub.slice(1) : sub}`;
}

/**
 * Port of Hono's `checkOptionalParameter`: every router registers
 * `/animal/:type?` as both `/animal` and `/animal/:type`.
 */
function expandOptionalParameter(path: string): string[] {
  if (!path.endsWith('?') || !path.includes(':')) return [path];

  const results: string[] = [];
  let basePath = '';
  for (const segment of path.split('/')) {
    if (segment !== '' && !segment.includes(':')) {
      basePath += '/' + segment;
    }
    else if (segment.includes(':')) {
      if (segment.endsWith('?')) {
        results.push(results.length === 0 && basePath === '' ? '/' : basePath);
        basePath += '/' + segment.slice(0, -1);
        results.push(basePath);
      }
      else {
        basePath += '/' + segment;
      }
    }
  }
  return [...new Set(results)];
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

const PARAM_SEGMENT = /^:([^{}]+)(\{.+\})?$/;

/**
 * The part of a path that decides which requests it matches. A parameter's
 * name does not (`/user/:id` and `/user/:name` match the same requests), but
 * its `{regexp}` constraint does.
 */
function matchKey(path: string, strict: boolean): string {
  let key = splitRoutingPath(path)
    .map((segment) => {
      const match = PARAM_SEGMENT.exec(segment);
      if (!match) return segment;
      const optional = match[1].endsWith('?') ? '?' : '';
      return `:${match[2] ?? ''}${optional}`;
    })
    .join('/');

  // With `strict: false`, Hono strips the trailing slash from the request
  // path, so `/a` and `/a/` are the same route.
  if (!strict && key.length > 1 && key.endsWith('/')) {
    key = key.slice(0, -1);
  }
  return key;
}

function getStaticString(node: TSESTree.Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? null;
  }
  return null;
}

function isFunction(
  node: TSESTree.Node,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return (
    node.type === 'ArrowFunctionExpression'
    || node.type === 'FunctionExpression'
  );
}

/**
 * Whether a call starts with a handler rather than a path: an inline function,
 * a middleware factory call such as `logger()`, or a lone non-string argument
 * (`.post(createBook)`). Hono itself only checks `typeof arg === 'string'`.
 */
function startsWithHandler(args: TSESTree.CallExpressionArgument[]): boolean {
  const first = args[0];
  if (!first || getStaticString(first) !== null) return false;
  return isFunction(first) || first.type === 'CallExpression' || args.length === 1;
}

/**
 * Where to report a call: the method name, so a long chain such as
 * `new Hono().get(...).get(...)` points at the offending link.
 */
function reportTarget(node: TSESTree.CallExpression): TSESTree.Node {
  return node.callee.type === 'MemberExpression' ? node.callee.property : node;
}

function hasMiddlewareLikeHandler(handlers: TSESTree.Node[]): boolean {
  return handlers.some(handler => isFunction(handler) && handler.params.length >= 2);
}

/** The block, program or arrow expression body a node is evaluated in. */
function getHome(node: TSESTree.Node): TSESTree.Node {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'Program'
      || current.type === 'BlockStatement'
      || current.type === 'StaticBlock'
      || (current.type === 'ArrowFunctionExpression' && current.expression)
    ) {
      return current;
    }
    current = current.parent;
  }
  /* c8 ignore next */
  return node;
}

function runsUnconditionallyIn(node: TSESTree.Node, home: TSESTree.Node): boolean {
  let current = node.parent;
  while (current) {
    if (current === home) return true;
    if (!UNCONDITIONAL_PARENTS.has(current.type)) return false;
    current = current.parent;
  }
  /* c8 ignore next */
  return false;
}

export const noDuplicateRoutes = createRule<Options, MessageIds>({
  name: 'no-duplicate-routes',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow registering the same route (method and path) more than once on a Hono app',
    },
    schema: [],
    messages: {
      duplicateRoute:
        '\'{{method}} {{path}}\' is already registered on line {{line}}. The handler registered here is unreachable.',
      shadowedByAll:
        '\'{{method}} {{path}}\' is unreachable because \'all()\' already handles \'{{path}}\' on line {{line}}.',
      duplicateMountedRoute:
        'Mounting at \'{{mountPath}}\' registers \'{{method}} {{path}}\', which is already registered on line {{line}}.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const nodeRefs = new Map<TSESTree.Node, InstanceRef>();
    const variableRefs = new Map<TSESLint.Scope.Variable, InstanceRef>();

    function resolveRef(node: TSESTree.Node): InstanceRef | undefined {
      const direct = nodeRefs.get(node);
      if (direct) return direct;

      if (
        node.type === 'TSNonNullExpression'
        || node.type === 'TSAsExpression'
        || node.type === 'TSSatisfiesExpression'
      ) {
        return resolveRef(node.expression);
      }

      if (node.type === 'Identifier') {
        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
        return variable ? variableRefs.get(variable) : undefined;
      }

      return undefined;
    }

    /**
     * Find the earlier route that already answers `method` on one of the
     * paths `path` expands to. `ALL` answers every method; a later `ALL`
     * after a specific method is a fallback, not a duplicate.
     */
    function findConflict(
      entries: RouteEntry[],
      method: string,
      path: string,
      strict: boolean,
    ): RouteEntry | undefined {
      const keys = new Set(expandOptionalParameter(path).map(p => matchKey(p, strict)));

      return entries.find(entry =>
        !entry.middlewareLike
        && (entry.method === method || entry.method === METHOD_ALL)
        && expandOptionalParameter(entry.path).some(p => keys.has(matchKey(p, strict))),
      );
    }

    function addRoute(
      ref: InstanceRef,
      method: string,
      path: string,
      node: TSESTree.CallExpression,
      middlewareLike: boolean,
    ) {
      if (ref.prefix === null) return;

      const fullPath = mergePath(ref.prefix, path);
      const conflict = findConflict(ref.table.entries, method, fullPath, ref.table.strict);
      if (conflict) {
        context.report({
          node: reportTarget(node),
          messageId:
            conflict.method === METHOD_ALL && method !== METHOD_ALL
              ? 'shadowedByAll'
              : 'duplicateRoute',
          data: { method, path: fullPath, line: conflict.line },
        });
      }

      ref.table.entries.push({
        method,
        path: fullPath,
        line: reportTarget(node).loc.start.line,
        middlewareLike,
      });
    }

    /** `get(path?, ...handlers)` and friends. */
    function handleRouteMethod(
      ref: InstanceRef,
      node: TSESTree.CallExpression,
      name: string,
    ) {
      const method = name.toUpperCase();
      const [first, ...rest] = node.arguments;
      let handlers: TSESTree.Node[];
      let path: string | null;

      if (startsWithHandler(node.arguments)) {
        // No path: the route reuses the instance's last path. A same-method
        // continuation (`.get('/a', h1).get(h2)`) is just more handlers for
        // the route already registered, like `.get('/a', h1, h2)`.
        path = ref.path;
        if (path === null || ref.lastMethods.has(method)) return;
        handlers = node.arguments;
      }
      else {
        path = getStaticString(first);
        ref.path = path;
        ref.lastMethods = new Set();
        if (path === null) return;
        handlers = rest;
      }

      addRoute(ref, method, path, node, hasMiddlewareLikeHandler(handlers));
      ref.lastMethods.add(method);
    }

    /** `on(method | method[], path | path[], ...handlers)`. */
    function handleOn(ref: InstanceRef, node: TSESTree.CallExpression) {
      const [methodArg, pathArg, ...handlers] = node.arguments;

      const methodNodes = methodArg?.type === 'ArrayExpression' ? methodArg.elements : [methodArg];
      const pathNodes = pathArg?.type === 'ArrayExpression' ? pathArg.elements : [pathArg];

      const methods = methodNodes.map(m => getStaticString(m ?? undefined)?.toUpperCase() ?? null);
      const paths = pathNodes.map(p => getStaticString(p ?? undefined));

      ref.lastMethods = new Set();
      ref.path = paths[paths.length - 1] ?? null;

      if (handlers.length === 0) return;
      const middlewareLike = hasMiddlewareLikeHandler(handlers);

      for (const path of paths) {
        if (path === null) continue;
        for (const method of methods) {
          if (method !== null) addRoute(ref, method, path, node, middlewareLike);
        }
      }
    }

    /** `use(path?, ...handlers)`: middleware is not a route, but it moves `#path`. */
    function handleUse(ref: InstanceRef, node: TSESTree.CallExpression) {
      ref.lastMethods = new Set();
      // `use(mw)` without a path registers on '*'.
      ref.path = startsWithHandler(node.arguments) ? '*' : getStaticString(node.arguments[0]);
    }

    /**
     * `route(path, sub)` copies the routes `sub` has *right now* under
     * `path`. Routes added to `sub` later never reach this app.
     */
    function handleRoute(ref: InstanceRef, node: TSESTree.CallExpression) {
      const [pathArg, subArg] = node.arguments;
      const mountPath = getStaticString(pathArg);
      if (mountPath === null || ref.prefix === null || !subArg) return;

      const sub = resolveRef(subArg);
      if (!sub) return;

      const prefix = mergePath(ref.prefix, mountPath);
      // Duplicates inside `sub` itself were already reported where they were
      // registered, so only compare against what this app had before.
      const existing = [...ref.table.entries];
      const reported = new Set<string>();

      for (const entry of [...sub.table.entries]) {
        const fullPath = mergePath(prefix, entry.path);
        const conflict = findConflict(existing, entry.method, fullPath, ref.table.strict);
        const reportKey = `${entry.method} ${fullPath}`;

        if (conflict && !reported.has(reportKey)) {
          reported.add(reportKey);
          context.report({
            node: reportTarget(node),
            messageId: 'duplicateMountedRoute',
            data: {
              mountPath,
              method: entry.method,
              path: fullPath,
              line: conflict.line,
            },
          });
        }

        ref.table.entries.push({ ...entry, path: fullPath });
      }
    }

    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Hono') {
          return;
        }

        const options = node.arguments[0];
        const strict = !(
          options?.type === 'ObjectExpression'
          && options.properties.some(
            property =>
              property.type === 'Property'
              && !property.computed
              && property.key.type === 'Identifier'
              && property.key.name === 'strict'
              && property.value.type === 'Literal'
              && property.value.value === false,
          )
        );

        nodeRefs.set(node, {
          table: { strict, entries: [], home: getHome(node) },
          prefix: '/',
          path: '/',
          lastMethods: new Set(),
        });
      },

      'CallExpression:exit'(node: TSESTree.CallExpression) {
        if (
          node.callee.type !== 'MemberExpression'
          || node.callee.computed
          || node.callee.property.type !== 'Identifier'
        ) {
          return;
        }

        const ref = resolveRef(node.callee.object);
        if (!ref) return;

        const name = node.callee.property.name;
        const isKnown
          = ROUTE_METHODS.has(name) || CHAINABLE_METHODS.has(name) || name === 'basePath';
        if (!isKnown) return;

        if (!runsUnconditionallyIn(node, ref.table.home)) {
          // It may or may not have run, so `#path` is no longer known.
          ref.path = null;
          ref.lastMethods = new Set();
          return;
        }

        if (name === 'basePath') {
          const path = getStaticString(node.arguments[0]);
          nodeRefs.set(node, {
            table: ref.table,
            prefix: path === null || ref.prefix === null ? null : mergePath(ref.prefix, path),
            path: '/',
            lastMethods: new Set(),
          });
          return;
        }

        if (ROUTE_METHODS.has(name)) handleRouteMethod(ref, node, name);
        else if (name === 'on') handleOn(ref, node);
        else if (name === 'use') handleUse(ref, node);
        else if (name === 'route') handleRoute(ref, node);

        // Every one of these returns `this`.
        nodeRefs.set(node, ref);
      },

      'VariableDeclarator:exit'(node: TSESTree.VariableDeclarator) {
        if (!node.init || node.id.type !== 'Identifier') return;

        const ref = resolveRef(node.init);
        if (!ref) return;

        for (const variable of sourceCode.getDeclaredVariables(node)) {
          // A variable that is reassigned may point at another app later.
          const reassigned = variable.references.some(
            reference => reference.isWrite() && reference.identifier !== node.id,
          );
          if (!reassigned) variableRefs.set(variable, ref);
        }
      },
    };
  },
});
