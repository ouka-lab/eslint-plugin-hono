# hono/no-multiple-next

Disallow multiple calls to `next()` in a single middleware execution path.

✅ Enabled in the `recommended` and `all` configs (🚨 `error`).

Hono middleware relies on `await next()` to pass control to the next middleware. Calling `next()` multiple times in the same middleware function will cause a runtime error ("next() called multiple times"). This rule detects and prevents such patterns.

## Examples

**Incorrect**

```typescript
const middleware = async (c, next) => {
  await next();
  await next(); // Error
};
```

```typescript
const middleware = async (c, next) => {
  if (condition) {
    await next();
  }
  await next(); // Error if condition is true
};
```

**Correct**

```typescript
const middleware = async (c, next) => {
  await next();
};
```

```typescript
const middleware = async (c, next) => {
  if (condition) {
    await next();
  } else {
    await next();
  }
};
```

---

[← Back to all rules](../../README.md#rules)
