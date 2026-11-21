# hono/basepath-variable-name

Enforce that a variable holding a `basePath()` instance is named after its base path.

⚙️ Enabled in the `all` config only (⚠️ `warn`).
🔧 Automatically fixable by the `--fix` CLI option.

When `const v1 = new Hono().basePath('/api')` is mounted somewhere, the variable name says one thing and the URL says another, so finding the code that serves `/api/...` means reading every `basePath()` call. This rule requires the variable to be named after the path it serves (`const api = new Hono().basePath('/api')`), so the name alone tells you the URL prefix. It is a naming convention rather than a bug, which is why it is in `all` only.

The rule checks `const`, `let` and `var` declarations whose value is a `basePath()` call on a Hono instance. That instance can be `new Hono()` itself, or a variable in the same file that can be traced back to `new Hono()`:

```typescript
const api = new Hono().basePath('/api');

const app = new Hono();
const users = app.basePath('/users');
```

Instances that cannot be traced to `new Hono()` in the same file (imports, function parameters, reassigned `let` variables) are not checked, so look-alikes such as `router.basePath('/api')` are never reported. Calls chained after `basePath()` (`new Hono().basePath('/api').get(...)`) still count, because they return the same instance; when a chain has several `basePath()` calls, the last one is used.

The expected name is built from the path as written in the call. It is not joined with the `basePath()` of the instance it is called on. Every word of every segment is joined in camelCase:

| Base path | Expected name |
| :--- | :--- |
| `/api` | `api` |
| `/api/v1` | `apiV1` |
| `/user-profiles` | `userProfiles` |
| `/API` | `api` (an all-uppercase first word is lowercased) |

Paths that have no usable name are skipped: `/`, paths with a parameter (`/:tenant`), a wildcard or a regexp, template literals with expressions, and paths whose name would not be a valid variable name (`/2024`, `/delete`, `/new`).

The fix renames the variable and every reference to it in the file, including `typeof` type queries. A shorthand property keeps its key (`{ app }` becomes `{ app: api }`, and `({ app = fallback } = obj)` becomes `({ app: api = fallback } = obj)`). The rule still reports the variable but does not fix it when it is exported (renaming would change the module's public API), when the expected name is already in use where the variable is visible, or when a type of the same name shares the binding (`type App = ...; const App = ...`). When two variables in overlapping scopes ask for the same name, only one is renamed per `--fix` pass; the other is then reported as a name collision and left for you to resolve. The fix always renames to the exact expected name, without any configured prefix or suffix.

## Options

```json
{
  "hono/basepath-variable-name": ["warn", { "prefixes": [], "suffixes": [] }]
}
```

- `prefixes` (array of non-empty strings, optional): Prefixes allowed before the expected name. With a prefix, the expected name is capitalized: `{ "prefixes": ["my"] }` allows `myApi` for `/api`. Defaults to `[]`.
- `suffixes` (array of non-empty strings, optional): Suffixes allowed after the expected name, added exactly as written: `{ "suffixes": ["App", "Routes"] }` allows `apiApp` and `apiRoutes` for `/api`. Defaults to `[]`.

With the defaults, only the exact name is allowed. When both options are set, every combination is allowed (`myApiApp`), as well as the exact name.

## Examples

**Incorrect**

```typescript
const app = new Hono().basePath('/api');
```

```typescript
const v1 = new Hono().basePath('/api/v1');
```

```typescript
const app = new Hono();
const routes = app.basePath('/users');
```

```typescript
// { "suffixes": ["App"] }
const apiRoutes = new Hono().basePath('/api');
```

**Correct**

```typescript
const api = new Hono().basePath('/api');
const apiV1 = new Hono().basePath('/api/v1');
const userProfiles = new Hono().basePath('/user-profiles');
```

```typescript
const app = new Hono();
const users = app.basePath('/users');
```

```typescript
// { "suffixes": ["App", "Routes"] }
const apiApp = new Hono().basePath('/api');
```

---

[← Back to all rules](../../README.md#rules)
