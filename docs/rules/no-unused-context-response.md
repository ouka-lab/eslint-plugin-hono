# hono/no-unused-context-response

Disallow unused calls to Context response methods (`c.json`, `c.text`, etc.).

✅ Enabled in the `recommended` and `all` configs (🚨 `error`).

In Hono, methods like `c.json()` create a response object but do not send it automatically. If the return value is not returned from the handler (or awaited/used), the request might hang or result in a 404.

## Examples

**Incorrect**

```typescript
app.get('/', (c) => {
  c.json({ message: 'hello' }); // return is missing!
});
```

**Correct**

```typescript
app.get('/', (c) => {
  return c.json({ message: 'hello' });
});
```

---

[← Back to all rules](../../README.md#rules)
