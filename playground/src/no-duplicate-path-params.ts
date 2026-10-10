// hono/no-duplicate-path-params
// A route path must not declare the same `:param` name twice.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-duplicate-path-params.md
import { Hono } from 'hono';

// ❌ no-duplicate-path-params: ':id' is declared twice, so only the user id is captured and the post id is unreachable
const broken = new Hono();
broken.get('/users/:id/posts/:id', (c) => {
  return c.text(c.req.param('id'));
});

// ✅ ok
const app = new Hono();
app.get('/users/:userId/posts/:postId', (c) => {
  return c.text(`${c.req.param('userId')}/${c.req.param('postId')}`);
});

app.route('/broken', broken);

export default app;
