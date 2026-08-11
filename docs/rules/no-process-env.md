# hono/no-process-env

Disallow the use of `process.env` in favor of `c.env`.

⚙️ Enabled in the `all` config only (⚠️ `warn`).

This rule enforces the use of `c.env` for accessing environment variables within Hono handlers instead of `process.env`. Using `c.env` ensures your application remains platform-agnostic, as it abstracts away environment-specific details (e.g., Cloudflare Workers bindings vs. Node.js `process.env`).

Note that `process.env` is perfectly valid on Node.js, Bun and Deno — this rule is only useful if you target, or want to keep the option of targeting, an edge runtime.

## Examples

**Incorrect**

```typescript
const app = new Hono();
app.get('/', (c) => {
  const apiKey = process.env.API_KEY; // Disallowed
  return c.text(apiKey);
});
```

**Correct**

```typescript
const app = new Hono();
app.get('/', (c) => {
  const apiKey = c.env.API_KEY;
  return c.text(apiKey);
});
```

---

[← Back to all rules](../../README.md#rules)
