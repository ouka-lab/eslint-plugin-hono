// hono/global-middleware-placement
// Register global middleware before the routes it is supposed to wrap.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/global-middleware-placement.md
import { Hono } from 'hono';

const late = new Hono();
late.get('/', c => c.text('ok'));

// ❌ global-middleware-placement: registered after the route, so it never wraps it
late.use('*', (c, next) => next());

// ✅ ok
const app = new Hono();
app.use('*', (c, next) => next());
app.get('/', c => c.text('ok'));

export { late };
export default app;
