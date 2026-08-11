# hono/prefer-http-exception

Suggest using `HTTPException` instead of generic `Error` for HTTP errors.

✅ Enabled in the `recommended` and `all` configs (⚠️ `warn`).

This rule detects when a standard `Error` is thrown with a message that corresponds to a standard HTTP status code (e.g., "Not Found", "Unauthorized"). In Hono applications, it is better to use `HTTPException` to return proper HTTP status codes.

## Examples

**Incorrect**

```typescript
throw new Error('Not Found');
throw new Error('Unauthorized');
throw new Error('Bad Request');
```

**Correct**

```typescript
import { HTTPException } from 'hono/http-exception';

throw new HTTPException(404, { message: 'Not Found' });
throw new HTTPException(401, { message: 'Unauthorized' });
throw new HTTPException(400, { message: 'Bad Request' });
```

---

[← Back to all rules](../../README.md#rules)
