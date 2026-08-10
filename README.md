# eslint-plugin-hono

🔥 ESLint plugin for [Hono](https://hono.dev/) and all Hono lovers

## Installation

```bash
npm install -D eslint-plugin-hono
```

Requires ESLint 9 or later (flat config).

## Usage

Add the recommended configuration to your `eslint.config.js`:

```javascript
import hono from "eslint-plugin-hono";

export default [
    hono.configs.recommended,
];
```

The config registers the plugin for you — there is no need to declare `plugins` yourself.

To enable every rule, including the stylistic and runtime-specific ones, use `all` instead:

```javascript
import hono from "eslint-plugin-hono";

export default [
    hono.configs.all,
];
```

To apply the rules only to specific files, or to tweak individual rules, spread the config and add your own entry after it:

```javascript
import tseslint from "typescript-eslint";
import hono from "eslint-plugin-hono";

export default [
    ...tseslint.configs.recommended,
    {
        ...hono.configs.recommended,
        files: ["src/**/*.ts"],
    },
    {
        files: ["src/**/*.ts"],
        rules: {
            "hono/no-process-env": "error",
            "hono/route-grouping": "warn",
        },
    },
];
```

## Rules

✅ = enabled in `recommended`. All rules are enabled in `all`.

| Rule | ✅ | Severity in `all` | 🔧 fix |
| :--- | :---: | :---: | :---: |
| [param-name-mismatch](#honoparam-name-mismatch) | ✅ | 🚨 error | |
| [no-multiple-next](#honono-multiple-next) | ✅ | 🚨 error | |
| [no-unused-context-response](#honono-unused-context-response) | ✅ | 🚨 error | |
| [prefer-http-exception](#honoprefer-http-exception) | ✅ | ⚠️ warn | |
| [route-grouping](#honoroute-grouping) | | ⚠️ warn | ✅ |
| [no-process-env](#honono-process-env) | | ⚠️ warn | |
| [global-middleware-placement](#honoglobal-middleware-placement) | | ⚠️ warn | |

`recommended` deliberately contains only the rules that catch real bugs and are safe for any Hono project. Stylistic rules (`route-grouping`, `global-middleware-placement`) and runtime-specific ones (`no-process-env` — `process.env` is perfectly valid on Node.js, Bun and Deno) are left out so that adding this plugin to an existing project does not flood it with errors.

### hono/route-grouping

Enforce grouping and ordering of routes by HTTP method and Hono instance.

This rule enhances code organization by checking three things:
1.  **Instance Grouping**: All route definitions for a specific Hono instance must be contiguous. Once you start defining routes for another instance, you cannot add more routes to the previous one.
2.  **Path Grouping**: Routes for the same path (e.g., `/users`) must be grouped together.
3.  **Method Order**: Within a path group, methods must follow a consistent order (e.g., `get` before `post`).

**Note**: `app.route()` calls are excluded from these checks. Method chains (e.g., `.get(...).post(...)`) are exempt from method order checking.

#### Options

```json
{
  "hono/route-grouping": ["warn", {
    "order": [
      "use",
      "all",
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "on"
    ]
  }]
}
```

`order`: (array of strings, optional) Specifies the desired order of HTTP methods. The default order is `["use", "all", "get", "post", "put", "patch", "delete", "options", "on"]`.

#### Examples

**Incorrect Path Grouping**

```typescript
const app = new Hono();
app.get('/path1', (c) => c.text('get'));
app.get('/path2', (c) => c.text('get'));
app.post('/path1', (c) => c.text('post'));
```

**Correct**

```typescript
const app = new Hono();
app.get('/path1', (c) => c.text('get'));
app.post('/path1', (c) => c.text('post'));
app.get('/path2', (c) => c.text('get'));
```

**Incorrect Method Order**

```typescript
const app = new Hono();
app.post('/path1', (c) => c.text('post'));
app.get('/path1', (c) => c.text('get'));
```

**Correct**

```typescript
const app = new Hono();
app.get('/path1', (c) => c.text('get'));
app.post('/path1', (c) => c.text('post'));
```

**Incorrect Instance Grouping**
```typescript
const books = new Hono();
const users = new Hono();

books.get('/books', (c) => c.text('get books'));
users.get('/users', (c) => c.text('get users'));
books.post('/books', (c) => c.text('create book')); // Error: books routes should be together
```

**Correct**
```typescript
const books = new Hono();
const users = new Hono();

books.get('/books', (c) => c.text('get books'));
books.post('/books', (c) => c.text('create book'));

users.get('/users', (c) => c.text('get users'));
```

### hono/prefer-http-exception

Suggest using `HTTPException` instead of generic `Error` for HTTP errors.

This rule detects when a standard `Error` is thrown with a message that corresponds to a standard HTTP status code (e.g., "Not Found", "Unauthorized"). In Hono applications, it is better to use `HTTPException` to return proper HTTP status codes.

#### Examples

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

### hono/param-name-mismatch

Ensure parameter name in `c.req.param()` matches the route definition.

This rule checks that the parameter names used in `c.req.param('name')` call inside a route handler match the parameters defined in the route path (e.g., `/posts/:postId`). This prevents runtime errors caused by typos or mismatched parameter names.

#### Examples

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

### hono/no-multiple-next

Disallow multiple calls to `next()` in a single middleware execution path.

Hono middleware relies on `await next()` to pass control to the next middleware. Calling `next()` multiple times in the same middleware function will cause a runtime error ("next() called multiple times"). This rule detects and prevents such patterns.

#### Examples

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

### hono/no-unused-context-response

Disallow unused calls to Context response methods (`c.json`, `c.text`, etc.).

In Hono, methods like `c.json()` create a response object but do not send it automatically. If the return value is not returned from the handler (or awaited/used), the request might hang or result in a 404.

#### Examples

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

### hono/no-process-env

Disallow the use of `process.env` in favor of `c.env`.

This rule enforces the use of `c.env` for accessing environment variables within Hono handlers instead of `process.env`. Using `c.env` ensures your application remains platform-agnostic, as it abstracts away environment-specific details (e.g., Cloudflare Workers bindings vs. Node.js `process.env`).

#### Examples

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

### hono/global-middleware-placement

Enforce that global middleware is placed before route definitions.

This rule ensures that global middleware (e.g., `app.use(logger)` or `app.use('*', logger)`) is defined immediately after the Hono instance is created, and before any routes (`app.get()`, `app.post()`, etc.) are defined. This improves code readability and predictability. Path-specific middleware (e.g., `app.use('/admin/*', adminAuth)`) is ignored by this rule to allow for logical grouping with the routes it applies to.

#### Examples

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

# License

Made by [Kanon](https://github.com/ysknsid25). Publish under [MIT License](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/LICENSE).