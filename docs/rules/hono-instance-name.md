# hono/hono-instance-name

Enforce a naming convention (a required prefix and/or suffix) for variables that hold a Hono instance.

⚙️ Enabled in the `all` config only (⚠️ `warn`).

When every sub-app is named `app`, `users`, `book`, `routes` or whatever came to mind, you cannot tell from a name whether it holds a Hono instance or the data it serves (`users` the router vs. `users` the array). This rule lets a project pick a convention, such as "every Hono instance ends in `App`", and reports the names that break it. It is a naming convention rather than a bug, which is why it is in `all` only.

The rule checks `const`, `let` and `var` declarations whose value creates a new Hono instance: `new Hono()`, optionally with generics, TypeScript wrappers (`as`, `satisfies`, `!`) and chained methods that return the same instance (`new Hono().use(logger()).get(...)`).

It does not check:

- **Instances that call `basePath()`.** A variable holding `new Hono().basePath('/api')` is named after its path by [`hono/basepath-variable-name`](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/basepath-variable-name.md), which is more specific. This rule never reports it, even when `basepath-variable-name` skips the path (`/`, `/:tenant`, a dynamic path), so the two rules never report the same declaration.
- **Names that do not create an instance**: aliases (`const b = a`), chains on an existing variable (`app.get(...)`), destructuring, imports, and look-alikes such as `new Router()` or `createApp()`.

There is no autofix: the rule cannot guess the name you want.

## Options

```json
{
  "hono/hono-instance-name": ["warn", { "prefixes": [], "suffixes": [] }]
}
```

- `prefixes` (array of non-empty strings, optional): The name must start with one of these. The prefix must end at a camelCase word boundary, so `{ "prefixes": ["api"] }` allows `api`, `apiUsers`, `api2` and `api_users`, but not `apiary`. A prefix that ends in a separator (`app_`) needs no boundary. Defaults to `[]`.
- `suffixes` (array of non-empty strings, optional): The name must end with one of these, exactly as written (case-sensitive): `{ "suffixes": ["App", "Router"] }` allows `usersApp` and `booksRouter`, but not `usersapp`. Defaults to `[]`.

When both are set, the name must satisfy both, and each one it misses is reported separately.

Unlike `basepath-variable-name`, where `prefixes` and `suffixes` list what is *allowed*, here they list what is *required*.

**With no options, there is no convention to enforce**, so the rule reports that instead: once per file, on the first Hono instance declaration, it warns that neither `prefixes` nor `suffixes` is configured. Enabling the `all` config therefore produces this warning until you configure the rule (or turn it off).

## Examples

**Incorrect**

```typescript
// { "suffixes": ["App"] }
const users = new Hono();
```

```typescript
// { "prefixes": ["api"] }
const apiary = new Hono();
```

```typescript
// { "prefixes": ["api"], "suffixes": ["App"] }
const apiUsers = new Hono(); // missing the "App" suffix
```

```typescript
// no options: reported once, as "no naming convention is enforced"
const app = new Hono();
```

**Correct**

```typescript
// { "suffixes": ["App"] }
const usersApp = new Hono();
const booksApp = new Hono().use(logger());

// Left to hono/basepath-variable-name
const api = new Hono().basePath('/api');

// Not a new instance
const routes = usersApp.get('/', c => c.text('ok'));
```

```typescript
// { "prefixes": ["api"], "suffixes": ["App"] }
const apiUsersApp = new Hono();
```

---

[← Back to all rules](../../README.md#rules)
