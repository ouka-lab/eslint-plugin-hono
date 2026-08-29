// hono/no-unused-context-response
// A response built with `c.json()`, `c.text()`, `c.redirect()`… must be returned or used.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-unused-context-response.md
import { Hono } from 'hono';

const app = new Hono();

// ❌ no-unused-context-response: this response is built and thrown away
app.get('/discarded', (c) => {
  c.json({ message: 'never sent' });
  return c.text('ok');
});

// ✅ ok
app.get('/returned', (c) => {
  return c.json({ message: 'sent' });
});

export default app;
