// hono/no-multiple-next
// A middleware must call `next()` at most once per execution path.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-multiple-next.md
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

// ❌ no-multiple-next: the downstream handler runs twice for one request
const doubleNext = async (c: Context, next: Next) => {
  await next();
  await next();
};

// ✅ ok
const singleNext = async (c: Context, next: Next) => {
  await next();
};

const app = new Hono();
app.use('*', singleNext);
app.get('/', c => c.text('ok'));

export { doubleNext };
export default app;
