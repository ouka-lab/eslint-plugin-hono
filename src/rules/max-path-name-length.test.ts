import { RuleTester } from 'eslint';
import { maxPathNameLength } from './max-path-name-length';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

// 30 and 31 characters
const SEG_30 = 'a'.repeat(30);
const SEG_31 = 'a'.repeat(31);

ruleTester.run('max-path-name-length', maxPathNameLength as unknown as import('eslint').Rule.RuleModule, {
  valid: [
    // Default max (30): exactly 30 characters is allowed
    `app.get('/${SEG_30}', (c) => c.text('ok'));`,
    `app.get('/users/${SEG_30}/items', (c) => c.text('ok'));`,
    `app.get('/', (c) => c.text('ok'));`,
    // The whole path may exceed the limit as long as each segment does not
    `app.get('/${SEG_30}/${SEG_30}/${SEG_30}', (c) => c.text('ok'));`,
    // Parameters are not part of the URL, so their names are not measured
    `app.get('/users/:${SEG_31}', (c) => c.text('ok'));`,
    `app.get('/users/:id{${'[0-9]'.repeat(10)}}', (c) => c.text('ok'));`,
    `app.get('/users/:${SEG_31}?', (c) => c.text('ok'));`,
    // Non-ASCII characters are counted per code point
    `app.get('/${'𝒂'.repeat(30)}', (c) => c.text('ok'));`,
    // Custom max
    {
      code: `app.get('/abcdefghij', (c) => c.text('ok'));`,
      options: [{ max: 10 }],
    },
    // Not route registrations
    `
      const value = map.get('${SEG_31}');
      axios.get('/${SEG_31}', { params: {} });
      const config = { params: {} };
      axios.get('/${SEG_31}', config);
      map.set('${SEG_31}', 1);
      emitter.on('${SEG_31}', listener);
      app.get(\`/\${prefix}/${SEG_31}\`, handler);
      app.use('/${SEG_31}/*', logger());
    `,
  ],
  invalid: [
    // Default max (30)
    {
      code: `app.get('/${SEG_31}', (c) => c.text('ok'));`,
      errors: [{
        messageId: 'tooLong',
        data: { segment: SEG_31, path: `/${SEG_31}`, length: 31, max: 30 },
      }],
    },
    // Custom max
    {
      code: `app.get('/users/abcdefghijk', h);`,
      options: [{ max: 10 }],
      errors: [{
        messageId: 'tooLong',
        data: { segment: 'abcdefghijk', path: '/users/abcdefghijk', length: 11, max: 10 },
      }],
    },
    // Every offending segment is reported
    {
      code: `app.get('/abcdef/ok/ghijkl', h);`,
      options: [{ max: 5 }],
      errors: [
        { messageId: 'tooLong', data: { segment: 'abcdef', path: '/abcdef/ok/ghijkl', length: 6, max: 5 } },
        { messageId: 'tooLong', data: { segment: 'ghijkl', path: '/abcdef/ok/ghijkl', length: 6, max: 5 } },
      ],
    },
    // Every route method, route(), basePath() and on() are checked
    {
      code: `
        const app = new Hono().basePath('/aaaaaa');
        app
          .get('/bbbbbb', h)
          .post('/cccccc', h)
          .put('/dddddd', h)
          .delete('/eeeeee', h)
          .patch('/ffffff', h)
          .options('/gggggg', h)
          .all('/hhhhhh', h);
        app.route('/iiiiii', books);
        app.on('GET', '/jjjjjj', h);
        app.on(['GET', 'POST'], ['/kkkkkk', '/ok', ...rest], h);
        app.get(\`/llllll\`, h);
        let reassigned = { params: {} };
        app.get('/mmmmmm', reassigned);
        app.get('/nnnnnn', importedHandler);
      `,
      options: [{ max: 5 }],
      errors: [
        'aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff', 'gggggg',
        'hhhhhh', 'iiiiii', 'jjjjjj', 'kkkkkk', 'llllll', 'mmmmmm', 'nnnnnn',
      ].map(segment => ({
        messageId: 'tooLong',
        data: { segment, path: `/${segment}`, length: 6, max: 5 },
      })),
    },
  ],
});
