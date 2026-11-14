// hono/valid-route-path
// Enforce naming conventions on route paths with `mustMatch`, `mustNotMatch`, and `disallowedWords`.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/valid-route-path.md
//
// This rule does nothing until it is configured, so this file configures it inline.
// Precedence: disallowedWords > mustNotMatch > mustMatch (only the strongest violation is reported).
/* eslint hono/valid-route-path: ["warn", {
  "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*$",
  "mustNotMatch": "^/v\\d+(/|$)",
  "disallowedWords": ["get", "create", "update", "delete"]
}] */
import { Hono } from 'hono';

const app = new Hono();

// ❌ valid-route-path: the HTTP method already says "get"; verbs do not belong in the path
app.get('/getUsers', c => c.json([]));

// ❌ valid-route-path: disallowedWords outranks mustMatch, so a kebab-case path is still reported
app.post('/users/create', c => c.json({}, 201));

// ❌ valid-route-path: version prefixes are banned by mustNotMatch even though the path is kebab-case
app.get('/v1/orders', c => c.json([]));

// ❌ valid-route-path: snake_case does not match the kebab-case mustMatch pattern
app.get('/order_items', c => c.json([]));

// ✅ ok
app.get('/users', c => c.json([]));
app.get('/users/:id', c => c.json({ id: c.req.param('id') }));
app.get('/order-items/:orderId', c => c.json({ id: c.req.param('orderId') }));
// Words inside a parameter name or a longer word are not matched
app.get('/updates/:getId', c => c.json({ id: c.req.param('getId') }));

export default app;
