// hono/no-process-env
// Read configuration from `c.env` so the app stays portable across runtimes.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-process-env.md
import { Hono } from 'hono';

const app = new Hono<{ Bindings: { API_KEY: string } }>();

// ❌ no-process-env: process.env is not populated on Workers, Deno or Bun edge runtimes
app.get('/from-process', (c) => {
  const apiKey = process.env.API_KEY;
  return c.json({ apiKey });
});

// ✅ ok
app.get('/from-bindings', (c) => {
  const apiKey = c.env.API_KEY;
  return c.json({ apiKey });
});

export default app;
