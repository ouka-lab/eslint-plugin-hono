# hono/max-path-name-length

Enforce a maximum length for each `/`-separated segment of a route path.

✅ Enabled in the `recommended` and `all` configs (⚠️ `warn`).

A segment such as `/get-all-active-users-with-pending-orders` is usually a sign that an endpoint is encoding a query, a filter, or a verb in its URL instead of using query parameters or a nested resource. Route paths are a public contract, so an overly long name becomes hard to rename once clients depend on it. This rule caps the length of every segment (30 characters by default) so such endpoints are caught when they are added. Unlike `valid-route-path`, which checks naming patterns, this rule only looks at length, which is why it is safe to enable in any Hono project.

The rule checks the static path string passed to:

- `get`, `post`, `put`, `delete`, `patch`, `options`, `query`, `all` — `app.get('/users', handler)`
- `on` — `app.on('GET', '/users', handler)`, including every element of a path array
- `route` — `app.route('/books', books)`
- `basePath` — `new Hono().basePath('/api')`

Each segment is measured on its own, so a long path made of short segments is allowed. Path parameters (`:id`, `:id{[0-9]+}`, `:id?`) are not measured, because their names never appear in the request URL. Length is counted in Unicode code points. Each path is checked as written in the call; it is not joined with a `basePath()` or `route()` prefix. Paths built from template literals with expressions, middleware paths passed to `use()`, and look-alike calls whose handler argument cannot be a handler (`axios.get('/a', { params })`) are not checked. Every segment that exceeds the limit is reported.

## Options

```json
{
  "hono/max-path-name-length": ["warn", { "max": 30 }]
}
```

- `max` (integer, optional, minimum `1`): The maximum number of characters allowed in a single static path segment. Defaults to `30`.

## Examples

**Incorrect**

```typescript
// 41 characters in one segment (default max: 30)
app.get('/get-all-active-users-with-pending-orders', (c) => c.json([]));
```

```typescript
// { "max": 10 }
app.get('/users/abcdefghijk', (c) => c.json([]));
```

**Correct**

```typescript
app.get('/users', (c) => c.json([]));
app.get('/users/active/orders', (c) => c.json([]));
// Parameter names are not measured
app.get('/users/:aVeryLongParameterNameThatIsNotInTheUrl', (c) => c.json({}));
```

---

[← Back to all rules](../../README.md#rules)
