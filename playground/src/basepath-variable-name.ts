// hono/basepath-variable-name
// Enforce that a variable holding a `basePath()` instance is named after its base path.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/basepath-variable-name.md
import { Hono } from 'hono';

const app = new Hono();

// ❌ basepath-variable-name: the variable is named `v1`, but it serves `/api`
const v1 = new Hono().basePath('/api');

// ❌ basepath-variable-name: an instance traced back to `new Hono()` counts too; `/user-profiles` asks for `userProfiles`
const profiles = app.basePath('/user-profiles');

// ✅ ok
const api = new Hono().basePath('/api');
const apiV2 = new Hono().basePath('/api/v2');
const users = app.basePath('/users');

v1.get('/health', c => c.text('ok'));
profiles.get('/', c => c.json([]));
api.get('/health', c => c.text('ok'));
apiV2.get('/health', c => c.text('ok'));
users.get('/', c => c.json([]));

export default app;
