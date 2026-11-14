# hono/valid-route-path

Enforce naming conventions on route paths with `mustMatch`, `mustNotMatch`, and `disallowedWords`.

⚙️ Enabled in the `all` config only (⚠️ `warn`).

Route paths are a public contract: once clients depend on `/getUsers` or `/order_items`, renaming them is a breaking change. This rule lets a project write its URL conventions down — kebab-case segments, no version prefixes, no verbs in paths — and have every new route checked against them. Conventions differ between projects, so this is a stylistic rule: it is only in `all`, and **it does nothing until at least one option is configured**.

The rule checks the static path string passed to:

- `get`, `post`, `put`, `delete`, `patch`, `options`, `query`, `all` — `app.get('/users', handler)`
- `on` — `app.on('GET', '/users', handler)`, including every element of a path array
- `route` — `app.route('/books', books)`
- `basePath` — `new Hono().basePath('/api')`

Each path is checked as written in the call; it is not joined with a `basePath()` or `route()` prefix. Paths built from template literals with expressions and middleware paths passed to `use()` (which are usually wildcard filters such as `/api/*`) are not checked. Calls whose handler argument cannot be a handler — `axios.get('/a', { params })`, or `axios.get('/a', config)` where `config` is a `const` declared in the same file with an object, array, or literal value — are not treated as routes. An argument whose value cannot be seen (an import, a function parameter, a `let`) is assumed to be a handler, so `axios.get('/Bad', importedConfig)` is still checked.

## Options

```json
{
  "hono/valid-route-path": ["warn", {
    "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*$",
    "mustNotMatch": "^/v\\d+(/|$)",
    "disallowedWords": ["get", "create", "update", "delete"]
  }]
}
```

All options are optional and have no default.

- `mustMatch` (string): A regular expression (compiled with the `u` flag) that every route path must match.
- `mustNotMatch` (string): A regular expression (compiled with the `u` flag) that no route path may match.
- `disallowedWords` (string[]): Words that must not appear in a route path. Matching is by whole word and case-insensitive: each static segment is split into words on non-alphanumeric characters and on camelCase boundaries, so `get` matches `/get-users`, `/users/get_all`, `/users/getAll`, and `/USERS/GET`, but not `/budget` or `/updates`. A multi-word entry such as `get-user` matches those words in sequence within one segment (`/getUser`, `/get-user`), but not across segments (`/get/user`). Parameter names (`:id`, `:id{[0-9]+}`) are never checked, because they do not appear in the request URL.

### Precedence

The options are ranked **`disallowedWords` > `mustNotMatch` > `mustMatch`**, and each path is reported at most once, for the strongest violation:

1. A path containing a disallowed word is reported for that word, even if it also hits `mustNotMatch` or fails `mustMatch` — and even if it satisfies `mustMatch`.
2. Otherwise, a path matching `mustNotMatch` is reported, even if it satisfies `mustMatch`.
3. Otherwise, a path that does not match `mustMatch` is reported.

So `mustMatch` describes the general shape of a path, and `mustNotMatch` and `disallowedWords` carve exceptions out of it.

## Examples

**Incorrect**

```typescript
// { "disallowedWords": ["get"] }
app.get('/get-users', (c) => c.text('ok'));
app.get('/users/getAll', (c) => c.text('ok'));
```

```typescript
// { "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*/?$" }
app.get('/getUsers', (c) => c.text('ok'));
```

```typescript
// { "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*/?$", "disallowedWords": ["delete"] }
// Reported for 'delete', although the path satisfies mustMatch
app.get('/users/delete', (c) => c.text('ok'));
```

```typescript
// { "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*/?$", "mustNotMatch": "[A-Z]" }
// Reported once, for mustNotMatch
app.get('/Users', (c) => c.text('ok'));
```

**Correct**

```typescript
// { "mustMatch": "^(/([a-z0-9]+(-[a-z0-9]+)*|:[a-zA-Z]+))*/?$" }
app.get('/users/:id', (c) => c.text('ok'));
app.post('/user-groups', (c) => c.text('ok'));
```

```typescript
// { "disallowedWords": ["update", "get", "delete"] }
// Whole words only, and parameter names are not checked
app.get('/updates', (c) => c.text('ok'));
app.get('/budget', (c) => c.text('ok'));
app.get('/users/:delete', (c) => c.text('ok'));
```

---

[← Back to all rules](../../README.md#rules)
