// hono/param-name-mismatch
// The key passed to `c.req.param()` must exist in the route path.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/param-name-mismatch.md
import { Hono } from 'hono';

const app = new Hono();

// ❌ param-name-mismatch: the route declares :postId but the handler reads 'id'
app.get('/posts/:postId', (c) => {
  const id = c.req.param('id');
  return c.text(id ?? '');
});

// ✅ ok
app.get('/comments/:commentId', (c) => {
  const commentId = c.req.param('commentId');
  return c.text(commentId);
});

export default app;
