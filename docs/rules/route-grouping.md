# hono/route-grouping

Enforce grouping and ordering of routes by HTTP method and Hono instance.

⚙️ Enabled in the `all` config only (⚠️ `warn`).
🔧 Automatically fixable by the `--fix` CLI option.

This rule enhances code organization by checking three things:

1.  **Instance Grouping**: All route definitions for a specific Hono instance must be contiguous. Once you start defining routes for another instance, you cannot add more routes to the previous one.
2.  **Path Grouping**: Routes for the same path (e.g., `/users`) must be grouped together.
3.  **Method Order**: Within a path group, methods must follow a consistent order (e.g., `get` before `post`).

**Note**: `app.route()` calls are excluded from these checks. Method chains (e.g., `.get(...).post(...)`) are exempt from method order checking.

## Options

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

## Examples

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

---

[← Back to all rules](../../README.md#rules)
