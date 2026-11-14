// hono/max-path-name-length
// Enforce a maximum length (default: 30) for each `/`-separated segment of a route path.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/max-path-name-length.md
import { Hono } from 'hono';

const app = new Hono();

// ❌ max-path-name-length: one segment is 41 characters; a filter is encoded in the URL
app.get('/get-all-active-users-with-pending-orders', c => c.json([]));

// ❌ max-path-name-length: only the offending segment matters, wherever it sits in the path
app.get('/users/:id/recently-viewed-products-and-categories', c => c.json([]));

// ✅ ok
app.get('/users', c => c.json([]));
app.get('/users/active/orders', c => c.json([]));
// Exactly 30 characters is allowed
app.get('/abcdefghijabcdefghijabcdefghij', c => c.json([]));
// Parameter names never appear in the URL, so they are not measured
app.get('/users/:aVeryLongParameterNameThatIsNotInTheUrl', c => c.json({ id: c.req.param('aVeryLongParameterNameThatIsNotInTheUrl') }));

export default app;
