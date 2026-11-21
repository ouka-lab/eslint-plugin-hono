// hono/hono-instance-name
// Enforce a naming convention (a required prefix and/or suffix) for variables that hold a Hono instance.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/hono-instance-name.md
//
// With no options the rule only warns that no convention is configured, so
// this sample sets one inline. The playground's eslint.config.mjs turns the
// rule off in every other sample for the same reason.
/* eslint hono/hono-instance-name: ["warn", { "suffixes": ["App"] }] */
import { Hono } from 'hono';

const rootApp = new Hono();

// ❌ hono-instance-name: `users` holds a Hono instance but does not end with `App`
const users = new Hono();

// ❌ hono-instance-name: a chain on `new Hono()` still creates the instance being named
const books = new Hono().get('/', c => c.json([]));

// ✅ ok
const usersApp = new Hono();
// basePath() instances are named by hono/basepath-variable-name, not this rule
const api = new Hono().basePath('/api');
// not a new instance, just the result of a chain on an existing one
const health = rootApp.get('/health', c => c.text('ok'));

users.get('/', c => c.json([]));
usersApp.get('/', c => c.json([]));
api.get('/health', c => c.text('ok'));
rootApp.route('/users', users);
rootApp.route('/books', books);
rootApp.route('/users-v2', usersApp);
rootApp.route('/', api);

export { health };
export default rootApp;
