# hono/max-return

Enforce a maximum number of `return` statements in a single route handler.

⚙️ Enabled in the `all` config only (⚠️ `warn`).

Every `return` in a handler is another way the request can end, and each one is a branch that has to be read, tested, and kept consistent (status codes, response shape). Once a handler grows past a handful of exit paths it is usually doing too much — validation, lookup, and formatting in one place — and is a good candidate for a lookup table, a validator middleware, or a helper function. This is a complexity guideline rather than a bug, so the rule is only in `all`.

The rule checks handlers passed to `get`, `post`, `put`, `patch`, `delete`, `options`, `all`, and `on` (including chained calls such as `.get('/a', h).post(h)`):

- Inline functions: `app.get('/', (c) => { … })`.
- Handlers passed by name, when they are defined in the same file as `function handler(c) { … }` or `const handler = (c) => { … }`. A handler used by several routes is reported once. Handlers bound with `let` / `var` (which may be reassigned) and imported handlers are not followed.

Only `return` statements that belong to the handler itself are counted; returns inside nested callbacks or helper functions are ignored. Expression-bodied arrow functions (`(c) => c.text('ok')`) have no `return` statements and are never reported.

Inspired by [`vitest/max-expects`](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/max-expects.md).

## Options

```json
{
  "hono/max-return": ["warn", {
    "max": 5
  }]
}
```

`max`: (integer ≥ 1, optional) The maximum number of `return` statements allowed in one route handler. Defaults to `5`.

## Examples

**Incorrect**

```typescript
// With the default { max: 5 }: 6 return statements
app.get('/orders/:id', (c) => {
  const status = c.req.query('status');
  if (!status) return c.json({ error: 'status is required' }, 400);
  if (status === 'pending') return c.json({ label: 'Pending' });
  if (status === 'paid') return c.json({ label: 'Paid' });
  if (status === 'shipped') return c.json({ label: 'Shipped' });
  if (status === 'cancelled') return c.json({ label: 'Cancelled' });
  return c.json({ error: 'unknown status' }, 400);
});
```

```typescript
// With { max: 2 }: handlers passed by name are checked too
function updateItem(c: Context) {
  if (a) return c.text('a');
  if (b) return c.text('b');
  return c.text('c');
}

app.put('/items/:id', updateItem);
```

**Correct**

```typescript
const LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

app.get('/orders/:id', (c) => {
  const status = c.req.query('status');
  if (!status) return c.json({ error: 'status is required' }, 400);
  const label = LABELS[status];
  if (!label) return c.json({ error: 'unknown status' }, 400);
  return c.json({ label });
});
```

```typescript
// Returns inside nested functions do not count toward the handler
app.get('/', async (c) => {
  const items = list.map((x) => {
    if (x.hidden) return null;
    return x.name;
  });
  return c.json(items);
});
```

---

[← Back to all rules](../../README.md#rules)
