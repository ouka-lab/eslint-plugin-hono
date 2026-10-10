# hono/no-duplicate-routes

Disallow registering the same route (HTTP method and path) more than once on a Hono app.

✅ Enabled in the `recommended` and `all` configs (🚨 `error`).

Hono runs handlers in [registration order](https://hono.dev/docs/api/routing#routing-priority) and stops at the first one that returns a response. Registering `GET /` twice is therefore not an override: the first handler always answers, and the second one is dead code that never runs. Nothing throws at startup, so the mistake usually surfaces as "my change has no effect". The same applies when `app.all()` already handles a path and a specific method is registered on it afterwards.

The rule follows routes the way Hono composes them, not just as literal strings:

- **Base paths** — `new Hono().basePath('/api')` prefixes every route, and clones created with `basePath()` share one route table with the app they came from, so `app.get('/api/book')` and `app.basePath('/api').get('/book')` collide.
- **Grouping** — `app.route('/book', book)` copies the routes `book` has *at that moment* under `/book` (joined with Hono's own `mergePath`, so `/book` + `/` is `/book`). Routes added to `book` after the `route()` call are not part of `app`, matching Hono's [grouping-order](https://hono.dev/docs/api/routing#grouping-ordering) behavior.
- **Chained routes** — a call without a path (`.get('/endpoint', a).post(b)`) reuses the last path, as Hono does.
- **`on()`** — every method × path combination is registered, methods are case-insensitive, and custom methods like `PURGE` are compared too.
- **Path matching** — parameter names do not matter (`/user/:id` and `/user/:name` match the same requests), but `{regexp}` constraints do. An optional parameter (`/animal/:type?`) registers both `/animal` and `/animal/:type`. `/a` and `/a/` are distinct unless the app is created with `{ strict: false }`.

To avoid false positives the rule stays silent when it cannot be sure: paths that are not static strings, routes registered inside `if`/ternaries/loops or in a function other than the one that created the app, instances that are imported or passed in as parameters, and earlier handlers that take a `next` parameter (they may hand the request on). Registering `app.all()` *after* a specific method is a common fallback (for example a 405 response) and is allowed.

## Examples

**Incorrect**

```typescript
const app = new Hono();

app.use('*', logger());
app.get('/', (c) => c.text('Hello'));
app.get('/', (c) => c.text('Hello2')); // never runs

// Parameter names do not make routes distinct
app.get('/user/:id', (c) => c.text('by id'));
app.get('/user/:name', (c) => c.text('by name'));

// all() already answers every method on /hello
app.all('/hello', (c) => c.text('Any Method'));
app.get('/hello', (c) => c.text('GET'));
```

**Incorrect** (base paths and grouping)

```typescript
const app = new Hono();
const api = app.basePath('/api');
app.get('/api/book', (c) => c.text('app'));
api.get('/book', (c) => c.text('api')); // GET /api/book again

const book = new Hono();
book.get('/', (c) => c.text('List Books'));
app.get('/book', (c) => c.text('app'));
app.route('/book', book); // mounts GET /book again
```

**Correct**

```typescript
const app = new Hono();

app.get('/', (c) => c.text('get'));
app.post('/', (c) => c.text('post'));

// all() after a specific method is a fallback for the other methods
app.get('/x', (c) => c.text('get'));
app.all('/x', (c) => c.text('Method Not Allowed', 405));

// A regexp constraint changes what the parameter matches
app.get('/post/:id{[0-9]+}', (c) => c.text('number'));
app.get('/post/:id', (c) => c.text('any'));

// route() copies a snapshot: routes added to `book` later are not mounted
const book = new Hono();
app.route('/book', book);
book.get('/', (c) => c.text('late'));
app.get('/book', (c) => c.text('app'));
```

---

[← Back to all rules](../../README.md#rules)
