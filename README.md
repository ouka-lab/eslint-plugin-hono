<img src="./assets/banner.svg" alt="eslint-plugin-hono" width="100%">

---

[![npm version](https://img.shields.io/npm/v/eslint-plugin-hono.svg)](https://www.npmjs.com/package/eslint-plugin-hono)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-hono.svg)](https://www.npmjs.com/package/eslint-plugin-hono)
[![GitHub last commit](https://img.shields.io/github/last-commit/ouka-lab/eslint-plugin-hono)](https://github.com/ouka-lab/eslint-plugin-hono/commits/master)
[![Test](https://github.com/ouka-lab/eslint-plugin-hono/actions/workflows/test.yml/badge.svg)](https://github.com/ouka-lab/eslint-plugin-hono/actions/workflows/test.yml)
[![Lint and Format](https://github.com/ouka-lab/eslint-plugin-hono/actions/workflows/lint.yml/badge.svg)](https://github.com/ouka-lab/eslint-plugin-hono/actions/workflows/lint.yml)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ouka-lab/eslint-plugin-hono?utm_source=oss&utm_medium=github&utm_campaign=ouka-lab%2Feslint-plugin-hono&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
[![License: MIT](https://img.shields.io/npm/l/eslint-plugin-hono.svg)](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/LICENSE)


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

Each rule links to its own documentation page.

✅ = enabled in `recommended`. All rules are enabled in `all`.
🔧 = automatically fixable by the `--fix` CLI option.

| Rule | Description | ✅ | Severity in `all` | 🔧 |
| :--- | :--- | :---: | :---: | :---: |
| [param-name-mismatch](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/param-name-mismatch.md) | Ensure parameter name in `c.req.param()` matches the route definition | ✅ | 🚨 error | |
| [no-duplicate-path-params](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-duplicate-path-params.md) | Disallow declaring the same path parameter name twice in one route path (`/users/:id/posts/:id`) | ✅ | 🚨 error | |
| [no-multiple-next](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-multiple-next.md) | Disallow multiple calls to `next()` in a single middleware execution path | ✅ | 🚨 error | |
| [no-unused-context-response](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-unused-context-response.md) | Disallow unused calls to Context response methods (`c.json`, `c.text`, etc.) | ✅ | 🚨 error | |
| [prefer-http-exception](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/prefer-http-exception.md) | Suggest using `HTTPException` instead of generic `Error` for HTTP errors | ✅ | ⚠️ warn | |
| [route-grouping](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/route-grouping.md) | Enforce grouping and ordering of routes by HTTP method and Hono instance | | ⚠️ warn | 🔧 |
| [no-process-env](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-process-env.md) | Disallow the use of `process.env` in favor of `c.env` | | ⚠️ warn | |
| [global-middleware-placement](https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/global-middleware-placement.md) | Enforce that global middleware is placed before route definitions | | ⚠️ warn | |

`recommended` deliberately contains only the rules that catch real bugs and are safe for any Hono project. Stylistic rules (`route-grouping`, `global-middleware-placement`) and runtime-specific ones (`no-process-env` — `process.env` is perfectly valid on Node.js, Bun and Deno) are left out so that adding this plugin to an existing project does not flood it with errors.

# License

MIT
