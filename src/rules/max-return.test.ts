import { RuleTester } from 'eslint';
import { maxReturn } from './max-return';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

const returns = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    `if (c.req.query('k') === '${i}') return c.text('${i}');`,
  ).join('\n');

ruleTester.run('max-return', maxReturn as unknown as import('eslint').Rule.RuleModule, {
  valid: [
    // Exactly at the default limit (5)
    `
      const app = new Hono();
      app.get('/', (c) => {
        ${returns(4)}
        return c.text('fallback');
      });
    `,
    // Expression-bodied handler
    `
      app.get('/', (c) => c.text('ok'));
    `,
    // Returns inside nested functions are not counted toward the handler
    `
      app.get('/', async (c) => {
        const items = [1, 2, 3].map((x) => {
          ${returns(6)}
          return x;
        });
        return c.json(items);
      });
    `,
    // Not a route method
    `
      something.use('/', (c) => {
        ${returns(6)}
      });
    `,
    // Map#get with a non-function argument is ignored
    `
      const value = map.get('key');
    `,
    // Named handler within the limit
    `
      const handler = (c) => {
        ${returns(4)}
        return c.text('fallback');
      };
      app.get('/', handler);
    `,
    // A function with many returns that is never used as a route handler
    `
      function helper(c) {
        ${returns(6)}
      }
      app.get('/', (c) => c.text('ok'));
    `,
    // let bindings may be reassigned, so they are not followed
    `
      let handler = (c) => {
        ${returns(6)}
      };
      app.get('/', handler);
    `,
    // Imported handlers cannot be inspected
    `
      import { handler } from './handler';
      app.get('/', handler);
    `,
    // Custom max
    {
      code: `
        app.post('/', (c) => {
          ${returns(7)}
          return c.text('fallback');
        });
      `,
      options: [{ max: 8 }],
    },
  ],
  invalid: [
    // Over the default limit
    {
      code: `
        const app = new Hono();
        app.get('/', (c) => {
          ${returns(5)}
          return c.text('fallback');
        });
      `,
      errors: [{ messageId: 'tooManyReturns', data: { count: 6, max: 5 } }],
    },
    // Custom max
    {
      code: `
        app.put('/items/:id', function (c) {
          if (a) return c.text('a');
          if (b) return c.text('b');
          return c.text('c');
        });
      `,
      options: [{ max: 2 }],
      errors: [{ messageId: 'tooManyReturns', data: { count: 3, max: 2 } }],
    },
    // Chained route without a path
    {
      code: `
        app.get('/a', (c) => c.text('a'))
          .post((c) => {
            if (a) return c.text('a');
            return c.text('b');
          });
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns' }],
    },
    // app.on and multiple handlers: only the offending handler is reported
    {
      code: `
        app.on(['GET', 'POST'], '/x', async (c, next) => {
          await next();
        }, (c) => {
          if (a) return c.text('a');
          return c.text('b');
        });
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns', line: 4 }],
    },
    // Nested route handlers are counted independently
    {
      code: `
        app.get('/outer', (c) => {
          sub.get('/inner', (c2) => {
            if (a) return c2.text('a');
            return c2.text('b');
          });
          return c.text('outer');
        });
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns', line: 3 }],
    },
    // Named handler declared with const
    {
      code: `
        const handler = (c) => {
          if (a) return c.text('a');
          return c.text('b');
        };
        app.get('/', handler);
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns', data: { count: 2, max: 1 }, line: 2 }],
    },
    // Function declaration used before it is defined (hoisted)
    {
      code: `
        app.post('/', handler);
        function handler(c) {
          if (a) return c.text('a');
          return c.text('b');
        }
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns', line: 3 }],
    },
    // Same handler on several routes is reported once
    {
      code: `
        const handler = function (c) {
          if (a) return c.text('a');
          return c.text('b');
        };
        app.get('/a', handler);
        app.get('/b', handler);
        app.on('POST', '/c', handler);
      `,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyReturns', line: 2 }],
    },
  ],
});
