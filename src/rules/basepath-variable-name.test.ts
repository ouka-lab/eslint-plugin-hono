import { RuleTester } from 'eslint';
import { basepathVariableName } from './basepath-variable-name';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

const error = (name: string, expected: string, path: string) => ({
  messageId: 'mismatch',
  data: { name, expected, path },
});

ruleTester.run('basepath-variable-name', basepathVariableName as unknown as import('eslint').Rule.RuleModule, {
  valid: [
    // Exact match
    `const api = new Hono().basePath('/api');`,
    `const api = new Hono().basePath('api');`,
    `const api = new Hono().basePath('/api/');`,
    `const api = new Hono<{ Bindings: Env }>().basePath('/api');`,
    `const api = new Hono().basePath(\`/api\`);`,
    // Segments and words are joined in camelCase
    `const apiV1 = new Hono().basePath('/api/v1');`,
    `const userProfiles = new Hono().basePath('/user-profiles');`,
    `const userProfiles = new Hono().basePath('/user_profiles');`,
    `const adminUserProfiles = new Hono().basePath('/admin/user-profiles');`,
    // An all-uppercase first word is lowercased as a whole
    `const api = new Hono().basePath('/API');`,
    // Through a variable that holds a Hono instance
    `
      const app = new Hono();
      const api = app.basePath('/api');
    `,
    `
      const app = new Hono().use(logger());
      const root = app;
      const api = root.basePath('/api');
    `,
    // Nested base paths are compared with the path as written
    `
      const api = new Hono().basePath('/api');
      const v1 = api.basePath('/v1');
    `,
    // Chained calls after basePath() keep the same instance
    `const api = new Hono().basePath('/api').get('/', (c) => c.text('ok'));`,
    // TypeScript wrappers
    `const api = new Hono().basePath('/api') as Hono;`,
    `const api: Hono = new Hono().basePath('/api');`,
    // Paths without a matching variable name are skipped
    `const app = new Hono().basePath('/');`,
    `const app = new Hono().basePath('');`,
    `const app = new Hono().basePath('/:tenant');`,
    `const app = new Hono().basePath('/api/:version');`,
    `const app = new Hono().basePath('/api/*');`,
    `const app = new Hono().basePath('/2024');`,
    `const app = new Hono().basePath('/delete');`,
    `const app = new Hono().basePath('/new');`,
    `const app = new Hono().basePath(\`/\${prefix}\`);`,
    `const app = new Hono().basePath(prefix);`,
    // Receivers that cannot be followed to new Hono()
    `
      import { app } from './app';
      const routes = app.basePath('/api');
    `,
    `
      function create(app) {
        const routes = app.basePath('/api');
        return routes;
      }
    `,
    `
      let app = new Hono();
      app = other;
      const routes = app.basePath('/api');
    `,
    `const routes = router.basePath('/api');`,
    `const routes = new Router().basePath('/api');`,
    `const routes = createApp().basePath('/api');`,
    `const routes = new Hono().custom().basePath('/api');`,
    // Not a basePath() result
    `const app = new Hono();`,
    `const app = new Hono().get('/api', (c) => c.text('ok'));`,
    `const { app } = new Hono().basePath('/api');`,
    `const app = new Hono().basePath('/api', extra);`,
    `const app = new Hono()['basePath']('/api');`,
    `
      let app;
      app = new Hono().basePath('/api');
    `,
    // Allowed prefixes and suffixes
    {
      code: `const apiApp = new Hono().basePath('/api');`,
      options: [{ suffixes: ['App', 'Routes'] }],
    },
    {
      code: `const apiRoutes = new Hono().basePath('/api');`,
      options: [{ suffixes: ['App', 'Routes'] }],
    },
    {
      code: `const api = new Hono().basePath('/api');`,
      options: [{ suffixes: ['App'] }],
    },
    {
      code: `const myUserProfiles = new Hono().basePath('/user-profiles');`,
      options: [{ prefixes: ['my'] }],
    },
    {
      code: `const myApiApp = new Hono().basePath('/api');`,
      options: [{ prefixes: ['my'], suffixes: ['App'] }],
    },
  ],
  invalid: [
    {
      code: `const app = new Hono().basePath('/api');`,
      output: `const api = new Hono().basePath('/api');`,
      errors: [error('app', 'api', '/api')],
    },
    {
      code: `const v1 = new Hono().basePath('/api/v1');`,
      output: `const apiV1 = new Hono().basePath('/api/v1');`,
      errors: [error('v1', 'apiV1', '/api/v1')],
    },
    {
      code: `const users = new Hono().basePath('/user-profiles');`,
      output: `const userProfiles = new Hono().basePath('/user-profiles');`,
      errors: [error('users', 'userProfiles', '/user-profiles')],
    },
    // Through a variable that holds a Hono instance
    {
      code: `
        const app = new Hono();
        const routes = app.basePath('/users');
      `,
      output: `
        const app = new Hono();
        const users = app.basePath('/users');
      `,
      errors: [error('routes', 'users', '/users')],
    },
    {
      code: `
        const a = new Hono();
        const b = a;
        const x = b.basePath('/api');
      `,
      output: `
        const a = new Hono();
        const b = a;
        const api = b.basePath('/api');
      `,
      errors: [error('x', 'api', '/api')],
    },
    // Chains and TypeScript wrappers
    {
      code: `const a = new Hono().basePath('/api').get('/', (c) => c.text('ok'));`,
      output: `const api = new Hono().basePath('/api').get('/', (c) => c.text('ok'));`,
      errors: [error('a', 'api', '/api')],
    },
    {
      code: `const a = new Hono().basePath('/old').basePath('/api');`,
      output: `const api = new Hono().basePath('/old').basePath('/api');`,
      errors: [error('a', 'api', '/api')],
    },
    {
      code: `const a = (new Hono() as Hono<Env>).basePath('/api') satisfies Hono;`,
      output: `const api = (new Hono() as Hono<Env>).basePath('/api') satisfies Hono;`,
      errors: [error('a', 'api', '/api')],
    },
    {
      code: `const app: Hono = new Hono().basePath('/api');`,
      output: `const api: Hono = new Hono().basePath('/api');`,
      errors: [error('app', 'api', '/api')],
    },
    // Every reference is renamed, including type queries
    {
      code: `
        const app = new Hono().basePath('/api');
        app.get('/', (c) => c.text('ok'));
        type AppType = typeof app;
        function mount() {
          return app;
        }
        export default app;
      `,
      output: `
        const api = new Hono().basePath('/api');
        api.get('/', (c) => c.text('ok'));
        type AppType = typeof api;
        function mount() {
          return api;
        }
        export default api;
      `,
      errors: [error('app', 'api', '/api')],
    },
    // A shorthand property keeps its key
    {
      code: `
        const app = new Hono().basePath('/api');
        const routes = { app };
      `,
      output: `
        const api = new Hono().basePath('/api');
        const routes = { app: api };
      `,
      errors: [error('app', 'api', '/api')],
    },
    // A defaulted shorthand in a destructuring assignment keeps its key too
    {
      code: `
        let app = new Hono().basePath('/api');
        ({ app = fallback } = replacement);
        ({ app } = replacement);
      `,
      output: `
        let api = new Hono().basePath('/api');
        ({ app: api = fallback } = replacement);
        ({ app: api } = replacement);
      `,
      errors: [error('app', 'api', '/api')],
    },
    // Two reports asking for the same name are fixed one pass at a time,
    // so they never create duplicate declarations
    {
      code: `
        const first = new Hono().basePath('/api');
        const second = new Hono().basePath('/api');
      `,
      output: `
        const api = new Hono().basePath('/api');
        const second = new Hono().basePath('/api');
      `,
      errors: [error('first', 'api', '/api'), error('second', 'api', '/api')],
    },
    {
      code: `
        const first = new Hono().basePath('/api');
        function f() {
          const second = new Hono().basePath('/api');
          return [first, second];
        }
      `,
      output: `
        const api = new Hono().basePath('/api');
        function f() {
          const second = new Hono().basePath('/api');
          return [api, second];
        }
      `,
      errors: [error('first', 'api', '/api'), error('second', 'api', '/api')],
    },
    // Reports in unrelated scopes are fixed together
    {
      code: `
        function f() {
          const first = new Hono().basePath('/api');
          return first;
        }
        function g() {
          const second = new Hono().basePath('/api');
          return second;
        }
      `,
      output: `
        function f() {
          const api = new Hono().basePath('/api');
          return api;
        }
        function g() {
          const api = new Hono().basePath('/api');
          return api;
        }
      `,
      errors: [error('first', 'api', '/api'), error('second', 'api', '/api')],
    },
    // A type and a value sharing one name: reported but not fixed
    {
      code: `
        type App = { ok: true };
        const App = new Hono().basePath('/api');
        const value: App = { ok: true };
      `,
      output: null,
      errors: [error('App', 'api', '/api')],
    },
    // Exported names are public API: reported but not fixed
    {
      code: `export const app = new Hono().basePath('/api');`,
      output: null,
      errors: [error('app', 'api', '/api')],
    },
    {
      code: `
        const app = new Hono().basePath('/api');
        export { app };
      `,
      output: null,
      errors: [error('app', 'api', '/api')],
    },
    // Renaming would collide with an existing name: reported but not fixed
    {
      code: `
        const api = 1;
        function f() {
          const app = new Hono().basePath('/api');
          return [app, api];
        }
      `,
      output: null,
      errors: [error('app', 'api', '/api')],
    },
    {
      code: `
        const app = new Hono().basePath('/api');
        function f() {
          const api = 1;
          return app;
        }
      `,
      output: null,
      errors: [error('app', 'api', '/api')],
    },
    {
      code: `
        const app = new Hono().basePath('/api');
        api.call();
      `,
      output: null,
      errors: [error('app', 'api', '/api')],
    },
    // Prefixes and suffixes are allowed only when configured
    {
      code: `const apiApp = new Hono().basePath('/api');`,
      output: `const api = new Hono().basePath('/api');`,
      errors: [error('apiApp', 'api', '/api')],
    },
    {
      code: `const apiRoutes = new Hono().basePath('/api');`,
      output: `const api = new Hono().basePath('/api');`,
      options: [{ suffixes: ['App'] }],
      errors: [error('apiRoutes', 'api', '/api')],
    },
    {
      code: `const myApi = new Hono().basePath('/api');`,
      output: `const api = new Hono().basePath('/api');`,
      options: [{ suffixes: ['My'] }],
      errors: [error('myApi', 'api', '/api')],
    },
  ],
});
