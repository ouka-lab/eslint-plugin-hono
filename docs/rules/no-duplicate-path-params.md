# hono/no-duplicate-path-params

Disallow declaring the same path parameter name twice in a route path.

✅ Enabled in the `recommended` and `all` configs (🚨 `error`).

Hono accepts a path like `/users/:id/posts/:id` without complaint, but the duplicate name is not an error you find out about at startup — it silently collapses. Only the first `:id` is captured, so `c.req.param('id')` always returns the user id and the post id is unreachable. Nothing throws and nothing 404s; the route simply reads the wrong value forever. This rule catches the typo where you meant two different names.

The check looks at a single path string only, so it covers the path passed to `get`, `post`, `put`, `patch`, `delete`, `options`, `all`, `use`, `on`, `route`, `mount` and `basePath`. Paths composed across `app.route()` boundaries are not analysed, because the sub app usually lives in another file.

## Examples

**Incorrect**

```typescript
const app = new Hono();

app.get('/users/:id/posts/:id', (c) => {
  // Always the user id — the second ':id' is unreachable
  const id = c.req.param('id');
  return c.text(id);
});

// Regexp constraints do not make the names distinct
app.get('/post/:date{[0-9]+}/:date{[a-z]+}', (c) => c.text('ok'));

// Mount paths and middleware paths are checked too
app.use('/users/:id/:id', mw);
app.route('/users/:id/:id', sub);
```

**Correct**

```typescript
const app = new Hono();

app.get('/users/:userId/posts/:postId', (c) => {
  const userId = c.req.param('userId');
  const postId = c.req.param('postId');
  return c.text(`${userId}/${postId}`);
});

app.get('/post/:date{[0-9]+}/:title{[a-z]+}', (c) => c.text('ok'));
```

---

[← Back to all rules](../../README.md#rules)
