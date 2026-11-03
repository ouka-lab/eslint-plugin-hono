# hono/no-commented-out-route

Disallow commented-out Hono routes and middleware registrations.

✅ Enabled in the `recommended` and `all` configs (⚠️ `warn`).

A commented-out `app.get('/users', ...)` is an endpoint that silently no longer exists: requests to it fall through to `notFound` and return 404, and nothing in the running app tells you why. The same goes for a commented-out `app.use(auth)` — the middleware is simply skipped. These comments tend to outlive the debugging session that created them, so delete the code (version control remembers it) or restore it.

The rule looks at every comment and reports one whose line starts with a call to `get`, `post`, `put`, `delete`, `patch`, `options`, `all`, `route` or `mount` with a string-literal path, `on` with a method string or array, or `use` with any arguments. The receiver can be anything (`app`, `api`, `this.app`), and a chained continuation line such as `// .post('/a', handler)` is caught too. Prose that merely mentions `app.get(` mid-sentence and JSDoc `@example` blocks (lines starting with `*`) are not reported. Consecutive `//` lines are separate comments, so a multi-line commented-out route is reported once, on its first line.

Because the check is purely textual, a comment like `// cache.get('/key')` that is not a Hono route will be reported as well. Suppress such cases with `// eslint-disable-next-line hono/no-commented-out-route`.

## Examples

**Incorrect**

```typescript
const app = new Hono();

// app.use(logger());

app.get('/users', (c) => c.json([]));
// app.post('/users', (c) => {
//   return c.json({ created: true }, 201);
// });
```

**Correct**

```typescript
const app = new Hono();

app.use(logger());

// Lists all users.
app.get('/users', (c) => c.json([]));
app.post('/users', (c) => {
  return c.json({ created: true }, 201);
});
```

---

[← Back to all rules](../../README.md#rules)
