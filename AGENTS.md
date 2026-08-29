# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

`eslint-plugin-hono` is an ESLint plugin that lints [Hono](https://hono.dev/)
applications. It ships a set of Hono-specific rules plus two flat configs
(`recommended` and `all`), and is published to npm as `eslint-plugin-hono`.

It is written in TypeScript, built with tsdown into ESM and CJS with type
declarations, tested with Vitest via ESLint's `RuleTester`, and linted with a
flat ESLint config using `typescript-eslint` and `@stylistic/eslint-plugin`.
Only the build output is published. Supported ESLint and Node versions,
toolchain pins, and coverage thresholds live in `package.json`,
`eslint.config.mjs` and `vitest.config.ts` — read them there rather than
duplicating them here.

## Layout

```
src/
  index.ts              Plugin entry point: rule registry + `recommended` / `all` configs
  utils.ts              `createRule` helper (RuleCreator) that derives each rule's docs URL
  rules/<name>.ts       One rule per file, exported as a camelCase const
  rules/<name>.test.ts  RuleTester suite colocated with the rule
docs/rules/<name>.md    Per-rule documentation page (GitHub only, not published to npm)
playground/
  src/<name>.ts         Runnable Hono sample that demonstrates one rule firing
                        (separate npm project, GitHub only, not published to npm)
.claude/skills/rule-docs/        Skill that syncs docs pages and the README rules table
.claude/skills/rule-playground/  Skill that writes and audits the playground samples
.claude/scripts/                 Helpers shared by those skills
```

### Rule conventions

- Rules are created with `createRule` from `src/utils.ts`. This wires
  `meta.docs.url` to `docs/rules/<name>.md` automatically — never hardcode a
  docs URL.
- The `name` passed to `createRule` must match the file name, the docs page
  name, and the key used in `src/index.ts`.
- Rules use `@typescript-eslint/utils` types (`TSESTree`) and declare explicit
  `Options` / `MessageIds` types.
- Adding a rule means touching **all** of: `src/rules/<name>.ts`,
  `src/rules/<name>.test.ts`, the `rules` object in `src/index.ts`, the
  `allRules` map, `playground/src/<name>.ts`, and (only when the rule catches
  real bugs and is safe for any Hono project) the `recommendedRules` map.
- `recommended` is deliberately narrow: bug-catching rules only. Stylistic rules
  and runtime-specific rules belong in `all` only. Do not move a rule into
  `recommended` without being asked.

## Documentation

**Whenever you add, remove, rename, or modify a rule, update the documentation
using the `/rule-docs` skill.** That includes changes to a rule's severity,
config membership, options schema, fixability, or described behavior.

The skill (`.claude/skills/rule-docs/`) reads rule metadata out of the built
plugin, writes/refreshes `docs/rules/*.md`, and rewrites the rules table in
`README.md`. It requires a fresh build first, because it imports the build
output.

A rule change is not complete until its docs page and its README table row
reflect it.

## Playground

`playground/` is a separate npm project that installs this plugin the way a
real consumer does (`"eslint-plugin-hono": "file:.."`) and holds exactly one
runnable Hono sample per rule at `playground/src/<name>.ts`.

**Whenever you add, remove, rename, or modify a rule, update the playground
using the `/rule-playground` skill.** One file per rule means a rule change
without a playground change leaves the sample stale or missing, and a stale
sample is worse than none — it claims a rule still fires when it may not.

The skill (`.claude/skills/rule-playground/`) writes the samples and audits
them: it lints the playground with the real plugin and checks that every
`// ❌` marker still triggers its rule and that nothing outside a marker does.
Like `docs/`, the playground is GitHub-only — `tsdown` never builds it and
`files` is limited to `["dist"]`. It requires a fresh build first, because the
audit script imports the build output.

`npm run lint` inside `playground/` exits non-zero **by design**; the samples
are deliberately broken. The audit script is the pass/fail gate.

## Hono CLI

The `hono` CLI ([honojs/cli](https://github.com/honojs/cli)) is installed
globally in this environment. Use it instead of guessing at Hono's behavior or
reaching for a web search — it is the fastest way to check what Hono actually
does before writing or changing a rule.

```bash
hono search <query>   # Search hono.dev (JSON by default; -p for human output, -l for more hits)
hono docs [path]      # Print a documentation page, e.g. hono docs /docs/api/context
hono request [file]   # Send a request through app.request() without starting a server
hono serve [entry]    # Start a server for a Hono app (--show-routes lists registered routes)
hono optimize [entry] # Build an optimized/bundled Hono app
```

### Where it helps in this repo

- **Before adding or changing a rule** — confirm the API the rule targets is
  real and still shaped the way you think:
  `hono search "createMiddleware" -p`, then `hono docs /docs/helpers/factory`.
  The documented behavior is what the rule's docs page and error message should
  describe.
- **Deciding `recommended` vs `all`** — the docs tell you whether a pattern is a
  genuine bug or a runtime-specific/stylistic preference, which is exactly the
  line `recommended` draws.
- **Validating a playground sample** — `playground/` is a real Hono project, so
  `hono request -P /some/path playground/src/<name>.ts` shows whether the code
  the rule flags actually misbehaves at runtime, and
  `hono serve --show-routes playground/src/<name>.ts` shows how Hono registers
  its routes. This complements the audit script, which only checks that the
  rule fires.
- **Writing docs pages** — `hono docs <path>` gives canonical wording and the
  upstream URL to link to from `docs/rules/<name>.md`.

Piping works, so a search result can be read directly:

```bash
hono search "middleware" | jq -r '.results[0].path' | xargs hono docs
```

### When stuck, ask the CLI

The CLI is young and gains commands and flags between releases, so this section
can fall behind. **Run `hono --help` and `hono <command> --help` whenever you
need something that is not listed above** — check whether a subcommand or flag
already does the job before writing a script or a one-off harness. `hono -v`
shows the installed version.

## Required checks before finishing

Before reporting any local work as done, run all four and confirm they pass
with no errors:

```bash
npm run test
npm run lint:fix
npm run build
node .claude/skills/rule-playground/scripts/audit-playground.mjs --check
```

The fourth needs the playground's dependencies installed
(`npm install` inside `playground/`, after `npm run build`). Run it whenever
you touched a rule; skip it only if the playground is not installed and your
change cannot affect it.

If any of them fails, fix the failure — do not report the work as complete.

## Do not commit

**Never run `git commit`, `git push`, or `git tag` on your own.** Leave all
changes in the working tree and let the maintainer review and commit them.
Only commit if the user explicitly asks you to in that request.
