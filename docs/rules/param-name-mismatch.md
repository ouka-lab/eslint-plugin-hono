# hono/param-name-mismatch

Ensure parameter name in `c.req.param()` matches the route definition.

✅ Enabled in the `recommended` and `all` configs (🚨 `error`).

This rule checks that the parameter names used in `c.req.param('name')` call inside a route handler match the parameters defined in the route path (e.g., `/posts/:postId`). This prevents runtime errors caused by typos or mismatched parameter names.

## Examples

**Incorrect**

```typescript
const app = new Hono();
app.get('/posts/:postId', (c) => {
  const id = c.req.param('id'); // 'id' is not defined in '/posts/:postId'
  return c.text(id);
});
```

**Correct**

```typescript
const app = new Hono();
app.get('/posts/:postId', (c) => {
  const postId = c.req.param('postId');
  return c.text(postId);
});
```

---

[← Back to all rules](../../README.md#rules)
