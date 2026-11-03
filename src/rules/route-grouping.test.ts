import { RuleTester } from 'eslint';
import { routeGrouping } from './route-grouping';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run(
  'route-grouping',
  routeGrouping as unknown as import('eslint').Rule.RuleModule,
  {
    valid: [
      // Basic grouping
      `
      const app = new Hono();
      app.get('/path1', (c) => c.text('get'));
      app.get('/path2', (c) => c.text('get'));
      app.post('/path1', (c) => c.text('post'));
    `,
      // Method chaining
      `
      const app = new Hono();
      app.get('/path1', (c) => c.text('get'))
         .post((c) => c.text('post'));
    `,
      // Correct order
      `
      const app = new Hono();
      app.get('/path1', (c) => c.text('get'));
      app.post('/path1', (c) => c.text('post'));
      app.delete('/path1', (c) => c.text('delete'));
    `,
      `
      const app = new Hono();
      const subApp = new Hono();
      app.get('/main', (c) => c.text('main'));
      app.route('/sub', subApp);
      subApp.get('/test', (c) => c.text('test'));
    `,
      // Multiple Hono instances correctly grouped
      `
      const books = new Hono();
      const users = new Hono();
      books.get('/books', (c) => c.text('get books'));
      books.post('/books', (c) => c.text('create book'));
      users.get('/users', (c) => c.text('get users'));
    `,
      // Multiple Hono instances with declaration in between
      `
      const books = new Hono();
      books.get('/books', (c) => c.text('get books'));
      const users = new Hono();
      users.get('/users', (c) => c.text('get users'));
      users.post('/users', (c) => c.text('create user'));
    `,
      // Wrong order in chain is now considered valid
      {
        code: `
        const app = new Hono();
        app.post('/path1', (c) => c.text('post'))
           .get((c) => c.text('get'));
      `,
      },
    ],
    invalid: [
      // Ungrouped routes
      {
        code: `
        const app = new Hono();
        app.get('/path1', (c) => c.text('get'));
        app.get('/path2', (c) => c.text('get'));
        app.post('/path1', (c) => c.text('post'));
      `,
        errors: [{ messageId: 'routeGroup' }],
      },
      // Wrong order (post before get)
      {
        code: `
        const app = new Hono();
        app.post('/path1', (c) => c.text('post'));
        app.get('/path1', (c) => c.text('get'));
      `,
        errors: [{ messageId: 'methodOrder' }],
      },
      // Ungrouped with different methods
      {
        code: `
        const app = new Hono();
        app.get('/a', c => c.text('a'));
        app.get('/b', c => c.text('b'));
        app.delete('/a', c => c.text('a'));
      `,
        errors: [{ messageId: 'routeGroup' }],
      },
      // Interleaved Hono instances
      {
        code: `
        const books = new Hono();
        const users = new Hono();
        books.get('/books', (c) => c.text('get books'));
        users.get('/users', (c) => c.text('get users'));
        books.post('/books', (c) => c.text('create book'));
      `,
        errors: [{ messageId: 'instanceGroup' }],
      },
    ],
  },
);
