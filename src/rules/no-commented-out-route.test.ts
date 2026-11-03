import { RuleTester } from 'eslint';
import { noCommentedOutRoute } from './no-commented-out-route';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

const error = { messageId: 'commentedOutRoute' };

ruleTester.run(
  'no-commented-out-route',
  noCommentedOutRoute as unknown as import('eslint').Rule.RuleModule,
  {
    valid: [
      `app.get('/users', c => c.text('ok'));`,
      `
        // Returns the list of users.
        app.get('/users', c => c.text('ok'));
      `,
      `/* plain block comment */`,
      `
        /**
         * Registers the user routes.
         *
         * @example
         * app.get('/users', handler);
         * app.use(logger());
         */
        export const register = () => {};
      `,
      `// map.get(key)`,
      `// cache.delete(id)`,
      `// headers.get(name) returns null when missing`,
      `// TODO: add app.get('/users') later`,
      `// see app.use() in the docs`,
      `// get('/users')`,
    ],
    invalid: [
      { code: `// app.get('/users', c => c.text('ok'))`, errors: [error] },
      { code: `// app.post("/users", handler)`, errors: [error] },
      { code: '// app.put(`/users/${id}`, handler)', errors: [error] },
      { code: `// app.delete('/users/:id', handler)`, errors: [error] },
      { code: `// app.patch('/users/:id', handler)`, errors: [error] },
      { code: `// app.options('/users', handler)`, errors: [error] },
      { code: `// app.all('*', handler)`, errors: [error] },
      { code: `// app.route('/api', api)`, errors: [error] },
      { code: `// app.mount('/legacy', legacyApp.fetch)`, errors: [error] },
      { code: `// app.on('PURGE', '/cache', handler)`, errors: [error] },
      { code: `// app.on(['GET', 'POST'], '/form', handler)`, errors: [error] },
      { code: `// app.use(logger())`, errors: [error] },
      { code: `// app.use('/api/*', auth)`, errors: [error] },
      { code: `//app.get('/no-space', handler)`, errors: [error] },
      { code: `// this.app.get('/users', handler)`, errors: [error] },
      { code: `// api?.get('/users', handler)`, errors: [error] },
      {
        code: `
          app
            .get('/a', handler)
            // .post('/a', handler)
            .put('/a', handler);
        `,
        errors: [error],
      },
      {
        code: `
          /*
          app.get('/users', (c) => {
            return c.text('ok');
          });
          */
        `,
        errors: [error],
      },
      {
        code: `
          // app.get('/users', (c) => {
          //   return c.text('ok');
          // });
        `,
        errors: [{ ...error, line: 2 }],
      },
      {
        code: `
          // app.get('/a', handler)
          app.get('/b', handler);
          // app.post('/c', handler)
        `,
        errors: [
          { ...error, line: 2 },
          { ...error, line: 4 },
        ],
      },
    ],
  },
);
