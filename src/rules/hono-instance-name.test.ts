import { RuleTester } from 'eslint';
import { honoInstanceName } from './hono-instance-name';
import * as parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
  },
});

const missingPrefix = (name: string, prefixes: string) => ({
  messageId: 'missingPrefix',
  data: { name, prefixes },
});
const missingSuffix = (name: string, suffixes: string) => ({
  messageId: 'missingSuffix',
  data: { name, suffixes },
});
const noConvention = { messageId: 'noConvention' };

const suffixApp = [{ suffixes: ['App'] }];
const prefixApi = [{ prefixes: ['api'] }];

ruleTester.run('hono-instance-name', honoInstanceName as unknown as import('eslint').Rule.RuleModule, {
  valid: [
    // Suffixes
    { code: `const usersApp = new Hono();`, options: suffixApp },
    { code: `const App = new Hono();`, options: suffixApp },
    { code: `const usersRouter = new Hono();`, options: [{ suffixes: ['App', 'Router'] }] },
    // Prefixes: at a camelCase boundary, or the prefix itself
    { code: `const apiUsers = new Hono();`, options: prefixApi },
    { code: `const api = new Hono();`, options: prefixApi },
    { code: `const api2 = new Hono();`, options: prefixApi },
    { code: `const api_users = new Hono();`, options: prefixApi },
    { code: `const app_users = new Hono();`, options: [{ prefixes: ['app_'] }] },
    // Both: each must be satisfied
    { code: `const apiUsersApp = new Hono();`, options: [{ prefixes: ['api'], suffixes: ['App'] }] },
    // Every declaration kind, generics, wrappers and chains
    { code: `let usersApp = new Hono();`, options: suffixApp },
    { code: `var usersApp = new Hono();`, options: suffixApp },
    { code: `export const usersApp = new Hono();`, options: suffixApp },
    { code: `const usersApp = new Hono<{ Bindings: Env }>();`, options: suffixApp },
    { code: `const usersApp: Hono = new Hono();`, options: suffixApp },
    { code: `const usersApp = new Hono() as Hono<Env>;`, options: suffixApp },
    { code: `const usersApp = new Hono().use(logger()).get('/', (c) => c.text('ok'));`, options: suffixApp },
    // basePath() is basepath-variable-name's job, even when that rule skips the path
    { code: `const v1 = new Hono().basePath('/api');`, options: suffixApp },
    { code: `const tenant = new Hono().basePath('/:tenant');`, options: suffixApp },
    { code: `const root = new Hono().basePath('/');`, options: suffixApp },
    { code: `const dynamic = new Hono().basePath(prefix);`, options: suffixApp },
    { code: `const chained = new Hono().use(logger()).basePath('/api').get('/', (c) => c.text('ok'));`, options: suffixApp },
    // Not a new Hono instance
    {
      code: `
        const usersApp = new Hono();
        const alias = usersApp;
        const routes = usersApp.get('/', (c) => c.text('ok'));
      `,
      options: suffixApp,
    },
    { code: `const router = new Router();`, options: suffixApp },
    { code: `const app = createApp();`, options: suffixApp },
    { code: `const app = new Hono().custom();`, options: suffixApp },
    { code: `const app = new hono.Hono();`, options: suffixApp },
    { code: `const { app } = new Hono();`, options: suffixApp },
    { code: `let app; app = new Hono();`, options: suffixApp },
    // No convention configured: nothing to report in a file without a Hono instance
    `const router = new Router();`,
    `const v1 = new Hono().basePath('/api');`,
  ],
  invalid: [
    // Suffixes
    {
      code: `const users = new Hono();`,
      options: suffixApp,
      errors: [missingSuffix('users', `'App'`)],
    },
    {
      code: `const usersapp = new Hono();`,
      options: suffixApp,
      errors: [missingSuffix('usersapp', `'App'`)],
    },
    {
      code: `const users = new Hono();`,
      options: [{ suffixes: ['App', 'Router'] }],
      errors: [missingSuffix('users', `'App', 'Router'`)],
    },
    // Prefixes
    {
      code: `const users = new Hono();`,
      options: prefixApi,
      errors: [missingPrefix('users', `'api'`)],
    },
    {
      code: `const apiary = new Hono();`,
      options: prefixApi,
      errors: [missingPrefix('apiary', `'api'`)],
    },
    // Both: each unmet constraint is its own report
    {
      code: `const apiUsers = new Hono();`,
      options: [{ prefixes: ['api'], suffixes: ['App'] }],
      errors: [missingSuffix('apiUsers', `'App'`)],
    },
    {
      code: `const users = new Hono();`,
      options: [{ prefixes: ['api'], suffixes: ['App'] }],
      errors: [missingPrefix('users', `'api'`), missingSuffix('users', `'App'`)],
    },
    // Wrappers, chains and every declaration kind
    {
      code: `const users = (new Hono<Env>() as Hono<Env>).use(logger()).get('/', (c) => c.text('ok'))!;`,
      options: suffixApp,
      errors: [missingSuffix('users', `'App'`)],
    },
    {
      code: `export let users = new Hono();`,
      options: suffixApp,
      errors: [missingSuffix('users', `'App'`)],
    },
    {
      code: `
        const usersApp = new Hono();
        const books = new Hono();
        const v1 = new Hono().basePath('/api');
      `,
      options: suffixApp,
      errors: [{ ...missingSuffix('books', `'App'`), line: 3 }],
    },
    // No convention configured: reported once per file, on the first Hono instance
    {
      code: `const app = new Hono();`,
      errors: [noConvention],
    },
    {
      code: `
        const v1 = new Hono().basePath('/api');
        const app = new Hono();
        const users = new Hono();
      `,
      errors: [{ ...noConvention, line: 3 }],
    },
    {
      code: `const app = new Hono();`,
      options: [{ prefixes: [], suffixes: [] }],
      errors: [noConvention],
    },
  ],
});
