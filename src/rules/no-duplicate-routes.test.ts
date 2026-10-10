import { RuleTester } from 'eslint';
import { noDuplicateRoutes } from './no-duplicate-routes';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run(
  'no-duplicate-routes',
  noDuplicateRoutes as unknown as import('eslint').Rule.RuleModule,
  {
    valid: [
      // Same path, different methods
      `
      const app = new Hono();
      app.get('/', (c) => c.text('get'));
      app.post('/', (c) => c.text('post'));
    `,
      // Middleware is not a route
      `
      const app = new Hono();
      app.use('*', logger());
      app.use('/a', mw);
      app.get('/a', (c) => c.text('a'));
    `,
      // Trailing slash is a different route under the default strict mode
      `
      const app = new Hono();
      app.get('/a', (c) => c.text('a'));
      app.get('/a/', (c) => c.text('a/'));
    `,
      // A regexp constraint changes what the parameter matches
      `
      const app = new Hono();
      app.get('/post/:id{[0-9]+}', (c) => c.text('number'));
      app.get('/post/:id', (c) => c.text('any'));
    `,
      // Wildcard and a concrete path are not the same route
      `
      const app = new Hono();
      app.get('/foo', (c) => c.text('foo'));
      app.get('*', (c) => c.text('fallback'));
    `,
      // all() after a specific method is a fallback for the other methods
      `
      const app = new Hono();
      app.get('/x', (c) => c.text('get'));
      app.all('/x', (c) => c.text('Method Not Allowed', 405));
    `,
      // Different instances
      `
      const book = new Hono();
      const app = new Hono();
      book.get('/', (c) => c.text('book'));
      app.get('/', (c) => c.text('app'));
    `,
      // Different base paths on one table
      `
      const app = new Hono();
      const v1 = app.basePath('/v1');
      const v2 = app.basePath('/v2');
      v1.get('/book', (c) => c.text('v1'));
      v2.get('/book', (c) => c.text('v2'));
    `,
      // Grouping without changing base
      `
      const book = new Hono();
      book.get('/book', (c) => c.text('List Books'));
      book.post('/book', (c) => c.text('Create Book'));
      const user = new Hono().basePath('/user');
      user.get('/', (c) => c.text('List Users'));
      user.post('/', (c) => c.text('Create User'));
      const app = new Hono();
      app.route('/', book);
      app.route('/', user);
    `,
      // route() copies a snapshot: routes added to the sub app later are not mounted
      `
      const book = new Hono();
      const app = new Hono();
      app.route('/book', book);
      book.get('/', (c) => c.text('late'));
      app.get('/book', (c) => c.text('app'));
    `,
      // Wrong grouping order: two is empty when it is mounted
      `
      const app = new Hono();
      const two = new Hono();
      const three = new Hono();
      three.get('/hi', (c) => c.text('hi'));
      app.route('/two', two);
      two.route('/three', three);
      app.get('/two/three/hi', (c) => c.text('app'));
    `,
      // An earlier handler that takes next() may hand the request on
      `
      const app = new Hono();
      app.get('/a', async (c, next) => { await next(); });
      app.get('/a', (c) => c.text('a'));
    `,
      // Dynamic paths cannot be compared
      `
      const app = new Hono();
      app.get(path, (c) => c.text('a'));
      app.get(path, (c) => c.text('b'));
      app.get(\`/\${prefix}/a\`, (c) => c.text('a'));
      app.get(\`/\${prefix}/a\`, (c) => c.text('b'));
    `,
      // A dynamic base path makes every path on that clone unknown
      `
      const app = new Hono();
      const api = app.basePath(prefix);
      api.get('/a', (c) => c.text('a'));
      api.get('/a', (c) => c.text('b'));
    `,
      // Conditional registration
      `
      const app = new Hono();
      if (dev) {
        app.get('/', (c) => c.text('dev'));
      } else {
        app.get('/', (c) => c.text('prod'));
      }
      isDev ? app.get('/x', a) : app.get('/x', b);
    `,
      // A route call in a function may run any number of times, or never
      `
      const app = new Hono();
      app.get('/', (c) => c.text('a'));
      function register() {
        app.get('/', (c) => c.text('b'));
      }
    `,
      // Imported and parameter instances are unknown
      `
      import app from './app';
      app.get('/', (c) => c.text('a'));
      app.get('/', (c) => c.text('b'));
      function register(router) {
        router.get('/', (c) => c.text('a'));
        router.get('/', (c) => c.text('b'));
      }
    `,
      // A shadowing variable is a different binding
      `
      const app = new Hono();
      app.get('/', (c) => c.text('a'));
      {
        const app = other();
        app.get('/', (c) => c.text('b'));
      }
    `,
      // A reassigned variable is not tracked
      `
      let app = new Hono();
      app.get('/', (c) => c.text('a'));
      app = new Hono();
      app.get('/', (c) => c.text('b'));
    `,
      // A same-method continuation adds handlers to one route
      `
      const app = new Hono();
      app.get('/a', mw).get((c) => c.text('a'));
      app.get('/b', (c, next) => next(), (c) => c.text('b'));
    `,
      // Chained route on different methods
      `
      const app = new Hono();
      app
        .get('/endpoint', (c) => c.text('GET'))
        .post((c) => c.text('POST'))
        .delete((c) => c.text('DELETE'));
    `,
      // A path-less call after an unknown path is skipped
      `
      const app = new Hono();
      app.get(path, (c) => c.text('a'));
      app.post((c) => c.text('b'));
      app.post((c) => c.text('c'));
    `,
      // Unknown methods are ignored and do not propagate the instance
      `
      const app = new Hono();
      app.fetch(req).get('/', a);
      app.fetch(req).get('/', b);
      app[method]('/', a);
      app[method]('/', b);
    `,
      // Something that is not a Hono instance
      `
      const router = new Router();
      router.get('/', a);
      router.get('/', b);
      const map = new Map();
      map.get('/');
      map.get('/');
    `,
      // route() with an unknown sub app or dynamic path
      `
      const app = new Hono();
      app.get('/book', a);
      app.route('/book', importedBook);
      const book = new Hono();
      book.get('/', b);
      app.route(prefix, book);
      app.route('/book');
    `,
      // on() without handlers, with dynamic parts
      `
      const app = new Hono();
      app.on('GET', '/a');
      app.on('GET', '/a', a);
      app.on(method, '/a', b);
      app.on('GET', [path], c);
      app.on('GET', [, '/b'], d);
    `,
      // Optional parameter in the middle of a path is not expanded
      `
      const app = new Hono();
      app.get('/a/:b?/c', x);
      app.get('/a/c', y);
    `,
      // Matcher keys of distinct optional segments
      `
      const app = new Hono();
      app.get('/:lang?', x);
      app.get('/en', y);
    `,
    ],
    invalid: [
      // The canonical example
      {
        code: `
        import { serve } from '@hono/node-server';
        import { Hono } from 'hono';
        import { logger } from 'hono/logger';

        const app = new Hono();

        app.use('*', logger());
        app.get('/', (c) => c.text('Hello'));
        app.get('/', (c) => c.text('Hello2'));

        serve(app);
      `,
        errors: [
          {
            messageId: 'duplicateRoute',
            data: { method: 'GET', path: '/', line: 9 },
            line: 10,
          },
        ],
      },
      // Other methods, generics on the constructor
      {
        code: `
        const app = new Hono<{ Bindings: Env }>();
        app.post('/a', a);
        app.post('/a', b);
        app.query('/q', a);
        app.query('/q', b);
        app.all('/x', a);
        app.all('/x', b);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'POST', path: '/a', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'QUERY', path: '/q', line: 5 } },
          { messageId: 'duplicateRoute', data: { method: 'ALL', path: '/x', line: 7 } },
        ],
      },
      // all() first shadows a later specific method
      {
        code: `
        const app = new Hono();
        app.all('/hello', (c) => c.text('Any Method'));
        app.get('/hello', (c) => c.text('GET'));
      `,
        errors: [
          { messageId: 'shadowedByAll', data: { method: 'GET', path: '/hello', line: 3 } },
        ],
      },
      // on() is case-insensitive and expands methods x paths
      {
        code: `
        const app = new Hono();
        app.on('get', '/a', a);
        app.get('/a', b);
        app.on(['PUT', 'DELETE'], '/post', c);
        app.delete('/post', d);
        app.on('GET', ['/hello', '/ja/hello', '/hello'], e);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/a', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'DELETE', path: '/post', line: 5 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/hello', line: 7 } },
        ],
      },
      // Custom HTTP methods via on()
      {
        code: `
        const app = new Hono();
        app.on('PURGE', '/cache', a);
        app.on('PURGE', '/cache', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'PURGE', path: '/cache', line: 3 } }],
      },
      // Parameter names do not change what a path matches
      {
        code: `
        const app = new Hono();
        app.get('/user/:id', a);
        app.get('/user/:name', b);
        app.get('/post/:date{[0-9]+}', c);
        app.get('/post/:day{[0-9]+}', d);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/user/:name', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/post/:day{[0-9]+}', line: 5 } },
        ],
      },
      // Optional parameters register two paths
      {
        code: `
        const app = new Hono();
        app.get('/api/animal/:type?', a);
        app.get('/api/animal', b);
        app.get('/api/animal/:kind', c);
        app.get('/:lang?', d);
        app.get('/', e);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/api/animal', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/api/animal/:kind', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/', line: 6 } },
        ],
      },
      // Base path on the constructor chain
      {
        code: `
        const api = new Hono().basePath('/api');
        api.get('/book', a);
        api.get('/book', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/api/book', line: 3 } }],
      },
      // basePath() clones share the routes table with the original
      {
        code: `
        const app = new Hono();
        const api = app.basePath('/api');
        const v1 = api.basePath('/v1');
        app.get('/api/book', a);
        api.get('/book', b);
        v1.get('/book', c);
        app.get('/api/v1/book', d);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/api/book', line: 5 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/api/v1/book', line: 7 } },
        ],
      },
      // basePath + '/' merges to the base path itself, as Hono's mergePath does
      {
        code: `
        const app = new Hono();
        const book = app.basePath('/book');
        app.get('/book', a);
        book.get('/', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/book', line: 4 } }],
      },
      // route() clashes with an existing route on the parent
      {
        code: `
        const book = new Hono();
        book.get('/', (c) => c.text('List Books'));
        book.get('/:id', (c) => c.text('Get Book'));
        const app = new Hono();
        app.get('/book', (c) => c.text('app'));
        app.route('/book', book);
      `,
        errors: [
          {
            messageId: 'duplicateMountedRoute',
            data: { mountPath: '/book', method: 'GET', path: '/book', line: 6 },
            line: 7,
          },
        ],
      },
      // A route registered on the parent after route()
      {
        code: `
        const book = new Hono();
        book.post('/', a);
        const app = new Hono();
        app.route('/book', book);
        app.post('/book', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'POST', path: '/book', line: 3 } }],
      },
      // Mounting the same sub app twice reports each route once per route() call
      {
        code: `
        const book = new Hono();
        book.get('/book', a);
        book.post('/book', b);
        const app = new Hono();
        app.route('/', book);
        app.route('/', book);
      `,
        errors: [
          { messageId: 'duplicateMountedRoute', data: { mountPath: '/', method: 'GET', path: '/book', line: 3 } },
          { messageId: 'duplicateMountedRoute', data: { mountPath: '/', method: 'POST', path: '/book', line: 4 } },
        ],
      },
      // A duplicate inside the sub app is reported once, where it is registered
      {
        code: `
        const book = new Hono();
        book.get('/', a);
        book.get('/', b);
        const app = new Hono();
        app.route('/book', book);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/', line: 3 } }],
      },
      // Nested grouping in the right order
      {
        code: `
        const app = new Hono();
        const two = new Hono();
        const three = new Hono();
        three.get('/hi', (c) => c.text('hi'));
        two.route('/three', three);
        app.route('/two', two);
        app.get('/two/three/hi', (c) => c.text('app'));
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/two/three/hi', line: 5 } }],
      },
      // Sub app with its own base path, mounted under a parent base path
      {
        code: `
        const user = new Hono().basePath('/user');
        user.get('/', a);
        const api = new Hono().basePath('/api');
        api.get('/user', b);
        api.route('/', user);
      `,
        errors: [{ messageId: 'duplicateMountedRoute', data: { mountPath: '/', method: 'GET', path: '/api/user', line: 5 } }],
      },
      // route() with an inline sub app
      {
        code: `
        const app = new Hono();
        app.get('/a/b', x);
        app.route('/a', new Hono().get('/b', y));
      `,
        errors: [{ messageId: 'duplicateMountedRoute', data: { mountPath: '/a', method: 'GET', path: '/a/b', line: 3 } }],
      },
      // Chained route: a path-less call reuses the last path
      {
        code: `
        const app = new Hono();
        app.get('/endpoint', a).post(b);
        app.post('/endpoint', c);
        app.get('/x', d);
        app.put(e);
        app.put('/x', f);
        app.use('/m', mw).get(g);
        app.get('/m', h);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'POST', path: '/endpoint', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'PUT', path: '/x', line: 6 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/m', line: 8 } },
        ],
      },
      // RPC-style chain on the declaration and on export default
      {
        code: `
        const route = new Hono()
          .get('/a', (c) => c.json({ a: 1 }))
          .get('/a', (c) => c.json({ a: 2 }));
        export default new Hono().post('/b', a).post('/b', b);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/a', line: 3 } },
          { messageId: 'duplicateRoute', data: { method: 'POST', path: '/b', line: 5 } },
        ],
      },
      // A Hono app built inside a function body
      {
        code: `
        export function createApp() {
          const app = new Hono();
          app.get('/', a);
          app.get('/', b);
          return app;
        }
        const factory = () => new Hono().get('/', a).get('/', b);
      `,
        errors: [
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/', line: 4 } },
          { messageId: 'duplicateRoute', data: { method: 'GET', path: '/', line: 8 } },
        ],
      },
      // strict: false makes '/a' and '/a/' the same route
      {
        code: `
        const app = new Hono({ strict: false });
        app.get('/a', a);
        app.get('/a/', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/a/', line: 3 } }],
      },
      // Template literal paths without expressions
      {
        code: `
        const app = new Hono();
        app.get(\`/a\`, a);
        app.get('/a', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/a', line: 3 } }],
      },
      // TypeScript wrappers around the instance
      {
        code: `
        const app = new Hono() as Hono<Env>;
        app!.get('/a', a);
        (app as Hono).get('/a', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/a', line: 3 } }],
      },
      // A later middleware-shaped handler is still unreachable
      {
        code: `
        const app = new Hono();
        app.get('/a', (c) => c.text('a'));
        app.get('/a', async (c, next) => { await next(); });
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/a', line: 3 } }],
      },
      // Hostname-style paths are compared like any other path
      {
        code: `
        const app = new Hono({ getPath: (req) => req.url });
        app.get('/www1.example.com/hello', a);
        app.get('/www1.example.com/hello', b);
      `,
        errors: [{ messageId: 'duplicateRoute', data: { method: 'GET', path: '/www1.example.com/hello', line: 3 } }],
      },
    ],
  },
);
