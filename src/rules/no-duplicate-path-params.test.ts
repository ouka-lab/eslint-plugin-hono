import { RuleTester } from 'eslint';
import { noDuplicatePathParams } from './no-duplicate-path-params';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run(
  'no-duplicate-path-params',
  noDuplicatePathParams as unknown as import('eslint').Rule.RuleModule,
  {
    valid: [
      // Distinct param names
      `
      const app = new Hono();
      app.get('/users/:userId/posts/:postId', (c) => c.text('ok'));
    `,
      // Single param
      `
      const app = new Hono();
      app.get('/users/:id', (c) => c.text('ok'));
    `,
      // No params at all
      `
      const app = new Hono();
      app.get('/hello', (c) => c.text('ok'));
    `,
      // ':id' and ':id2' are different names
      `
      const app = new Hono();
      app.get('/posts/:id/:id2', (c) => c.text('ok'));
    `,
      // Regexp params with distinct names
      `
      const app = new Hono();
      app.get('/post/:date{[0-9]+}/:title{[a-z]+}', (c) => c.text('ok'));
    `,
      // Nested braces inside a regexp constraint are skipped, not read as names
      `
      const app = new Hono();
      app.get('/files/:name{\\\\d{4}}/:other', (c) => c.text('ok'));
    `,
      // Optional param followed by a different one
      `
      const app = new Hono();
      app.get('/posts/:id?/comments/:commentId', (c) => c.text('ok'));
    `,
      // Wildcard has no name
      `
      const app = new Hono();
      app.get('/wildcard/*', (c) => c.text('ok'));
    `,
      // use() without a path argument
      `
      const app = new Hono();
      app.use(logger());
    `,
      // Template literal with an expression is not analysable
      `
      const app = new Hono();
      app.get(\`/users/\${prefix}/:id/:id\`, (c) => c.text('ok'));
    `,
      // A tagged template is not a route path. It is also the only place where
      // the parser produces a null `cooked`, so reading it must stay guarded.
      `
      const app = new Hono();
      app.get(sql\`/users/:id/:id\`, (c) => c.text('ok'));
    `,
      // Not a route path: does not start with '/'
      `
      cache.get('foo::bar::bar');
    `,
      // Same, written as a template literal
      `
      cache.get(\`foo::bar::bar\`);
    `,
      // A bare ':' is not a param
      `
      const app = new Hono();
      app.get('/a/:/b/:', (c) => c.text('ok'));
    `,
      // Non-member call is ignored
      `
      get('/users/:id/:id');
    `,
      // Computed member access is ignored
      `
      const app = new Hono();
      app[method]('/users/:id/:id', (c) => c.text('ok'));
    `,
      // A method that takes no route path
      `
      const app = new Hono();
      app.fire('/users/:id/:id');
    `,
      // on() with only a method argument
      `
      const app = new Hono();
      app.on('GET');
    `,
      // Sparse array of paths
      `
      const app = new Hono();
      app.on('GET', [, '/users/:id'], (c) => c.text('ok'));
    `,
    ],
    invalid: [
      // The canonical case
      {
        code: `
        const app = new Hono();
        app.get('/users/:id/posts/:id', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Three occurrences still report once
      {
        code: `
        const app = new Hono();
        app.get('/a/:id/b/:id/c/:id', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Two distinct duplicated names report twice
      {
        code: `
        const app = new Hono();
        app.get('/a/:x/:x/b/:y/:y', (c) => c.text('ok'));
      `,
        errors: [
          { messageId: 'duplicateParam' },
          { messageId: 'duplicateParam' },
        ],
      },
      // Other HTTP methods
      {
        code: `
        const app = new Hono();
        app.post('/users/:id/:id', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      {
        code: `
        const app = new Hono();
        app.delete('/users/:id/:id', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Middleware
      {
        code: `
        const app = new Hono();
        app.use('/users/:id/:id', mw);
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // on(): the path is the second argument
      {
        code: `
        const app = new Hono();
        app.on('GET', '/users/:id/posts/:id', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // on() with an array of paths
      {
        code: `
        const app = new Hono();
        app.on(['GET', 'POST'], ['/a/:x/:x'], (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Mount path of a sub app
      {
        code: `
        const app = new Hono();
        app.route('/users/:id/:id', sub);
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // mount(): the base path of a foreign application handler
      {
        code: `
        const app = new Hono();
        app.mount('/a/:id/:id', anotherApp);
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // basePath
      {
        code: `
        const app = new Hono().basePath('/:v/:v');
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Regexp params sharing a name
      {
        code: `
        const app = new Hono();
        app.get('/post/:date{[0-9]+}/:date{[a-z]+}', (c) => c.text('ok'));
      `,
        errors: [
          {
            message:
                            'Route path \'/post/:date{[0-9]+}/:date{[a-z]+}\' declares \':date\' more than once. Give each path parameter a unique name.',
          },
        ],
      },
      // One of the two is optional
      {
        code: `
        const app = new Hono();
        app.get('/posts/:id/comments/:id?', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Template literal without expressions
      {
        code: `
        const app = new Hono();
        app.get(\`/users/:id/posts/:id\`, (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
      // Method chaining
      {
        code: `
        const app = new Hono();
        app.get('/a/:id', (c) => c.text('ok')).get('/b/:x/:x', (c) => c.text('ok'));
      `,
        errors: [{ messageId: 'duplicateParam' }],
      },
    ],
  },
);
