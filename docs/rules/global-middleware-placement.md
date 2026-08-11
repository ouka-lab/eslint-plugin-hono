# hono/global-middleware-placement

Enforce that global middleware is placed before route definitions.

⚙️ Enabled in the `all` config only (⚠️ `warn`).

This rule ensures that global middleware (e.g., `app.use(logger)` or `app.use('*', logger)`) is defined immediately after the Hono instance is created, and before any routes (`app.get()`, `app.post()`, etc.) are defined. This improves code readability and predictability. Path-specific middleware (e.g., `app.use('/admin/*', adminAuth)`) is ignored by this rule to allow for logical grouping with the routes it applies to.

## Examples

**Incorrect**

```typescript
const app = new Hono();
app.get('/', (c) => c.text('Hello'));
app.use('*', logger()); // Global middleware defined after a route.
```

**Correct**

```typescript
const app = new Hono();
app.use('*', logger());
app.get('/', (c) => c.text('Hello'));
app.use('/admin', adminOnly()); // Path-specific middleware can be defined later.
app.get('/admin/dashboard', (c) => c.text('Dashboard'));
```

---

[← Back to all rules](../../README.md#rules)
