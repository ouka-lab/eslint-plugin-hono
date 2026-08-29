// hono/prefer-http-exception
// Throw `HTTPException` instead of a generic `Error` carrying an HTTP status message.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/prefer-http-exception.md
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const app = new Hono();

// ❌ prefer-http-exception: a generic Error surfaces as a 500, not a 404
app.get('/posts/:id', () => {
  throw new Error('Not Found');
});

// ✅ ok
app.get('/users/:id', () => {
  throw new HTTPException(404, { message: 'Not Found' });
});

export default app;
