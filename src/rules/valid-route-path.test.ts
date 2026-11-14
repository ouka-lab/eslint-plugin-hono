import { RuleTester } from 'eslint';
import { validRoutePath } from './valid-route-path';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

const KEBAB = '^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*/?$';

ruleTester.run('valid-route-path', validRoutePath as unknown as import('eslint').Rule.RuleModule, {
  valid: [
    // No options: the rule does nothing
    `
      app.get('/Get_Users', (c) => c.text('ok'));
    `,
    // mustMatch satisfied
    {
      code: `
        app.get('/users/:id', (c) => c.text('ok'));
        app.post('/user-groups', handler);
        app.get('/', (c) => c.text('ok'));
      `,
      options: [{ mustMatch: KEBAB }],
    },
    // mustNotMatch not hit
    {
      code: `app.get('/users', (c) => c.text('ok'));`,
      options: [{ mustNotMatch: '[A-Z]' }],
    },
    // Disallowed words only match whole words, not substrings
    {
      code: `
        app.get('/updates', (c) => c.text('ok'));
        app.get('/budget', (c) => c.text('ok'));
      `,
      options: [{ disallowedWords: ['update', 'get'] }],
    },
    // Parameter names are not part of the URL, so they are not checked
    {
      code: `app.get('/users/:delete', (c) => c.text('ok'));`,
      options: [{ disallowedWords: ['delete'] }],
    },
    // Multi-word entries match within one segment only
    {
      code: `app.get('/get/user', (c) => c.text('ok'));`,
      options: [{ disallowedWords: ['get-user'] }],
    },
    // Not route registrations
    {
      code: `
        const value = map.get('Bad_Path');
        axios.get('/Bad_Path', { params: {} });
        map.set('Bad_Path', 1);
        emitter.on('Bad_Path', listener);
        app.get(\`/\${prefix}/Bad\`, handler);
        app.use('/Bad_Path/*', logger());
      `,
      options: [{ mustMatch: KEBAB }],
    },
  ],
  invalid: [
    // mustMatch
    {
      code: `app.get('/getUsers', (c) => c.text('ok'));`,
      options: [{ mustMatch: KEBAB }],
      errors: [{ messageId: 'mustMatch', data: { path: '/getUsers', pattern: KEBAB } }],
    },
    // mustNotMatch
    {
      code: `app.post('/users/', handler);`,
      options: [{ mustNotMatch: '.+/$' }],
      errors: [{ messageId: 'mustNotMatch', data: { path: '/users/', pattern: '.+/$' } }],
    },
    // disallowedWords: kebab, snake and camelCase words are all recognized
    {
      code: `
        app.get('/get-users', h);
        app.get('/users/get_all', h);
        app.get('/users/getAll', h);
        app.get('/USERS/GET', h);
      `,
      options: [{ disallowedWords: ['get'] }],
      errors: [
        { messageId: 'disallowedWord', data: { path: '/get-users', word: 'get' }, line: 2 },
        { messageId: 'disallowedWord', data: { path: '/users/get_all', word: 'get' }, line: 3 },
        { messageId: 'disallowedWord', data: { path: '/users/getAll', word: 'get' }, line: 4 },
        { messageId: 'disallowedWord', data: { path: '/USERS/GET', word: 'get' }, line: 5 },
      ],
    },
    // Multi-word entries
    {
      code: `app.get('/api/getUser', h);`,
      options: [{ disallowedWords: ['get-user'] }],
      errors: [{ messageId: 'disallowedWord', data: { path: '/api/getUser', word: 'get-user' } }],
    },
    // Precedence: disallowedWords wins over mustNotMatch and mustMatch
    {
      code: `app.get('/Delete', h);`,
      options: [{ mustMatch: KEBAB, mustNotMatch: '[A-Z]', disallowedWords: ['delete'] }],
      errors: [{ messageId: 'disallowedWord' }],
    },
    // Precedence: disallowedWords is reported even when mustMatch is satisfied
    {
      code: `app.get('/users/delete', h);`,
      options: [{ mustMatch: KEBAB, disallowedWords: ['delete'] }],
      errors: [{ messageId: 'disallowedWord' }],
    },
    // Precedence: mustNotMatch wins over mustMatch
    {
      code: `app.get('/Users', h);`,
      options: [{ mustMatch: KEBAB, mustNotMatch: '[A-Z]' }],
      errors: [{ messageId: 'mustNotMatch' }],
    },
    // Precedence: mustNotMatch is reported even when mustMatch is satisfied
    {
      code: `app.get('/v1/users', h);`,
      options: [{ mustMatch: KEBAB, mustNotMatch: '^/v\\d+/' }],
      errors: [{ messageId: 'mustNotMatch' }],
    },
    // Every route method, route(), basePath() and on() are checked
    {
      code: `
        const app = new Hono().basePath('/API');
        app
          .get('/A', h)
          .post('/B', h)
          .put('/C', h)
          .delete('/D', h)
          .patch('/E', h)
          .options('/F', h)
          .all('/G', h);
        app.route('/Books', books);
        app.on('GET', '/H', h);
        app.on(['GET', 'POST'], ['/I', '/ok', ...rest], h);
        app.get(\`/Template\`, h);
      `,
      options: [{ mustNotMatch: '[A-Z]' }],
      errors: [
        { messageId: 'mustNotMatch', data: { path: '/API', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/A', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/B', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/C', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/D', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/E', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/F', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/G', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/Books', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/H', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/I', pattern: '[A-Z]' } },
        { messageId: 'mustNotMatch', data: { path: '/Template', pattern: '[A-Z]' } },
      ],
    },
  ],
});
