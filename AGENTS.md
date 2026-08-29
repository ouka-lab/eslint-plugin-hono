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
.claude/skills/rule-docs/  Skill that syncs docs pages and the README rules table
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
  `allRules` map, and (only when the rule catches real bugs and is safe for any
  Hono project) the `recommendedRules` map.
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

## Required checks before finishing

Before reporting any local work as done, run all three and confirm they pass
with no errors:

```bash
npm run test
npm run lint:fix
npm run build
```

If any of them fails, fix the failure — do not report the work as complete.

## Do not commit

**Never run `git commit`, `git push`, or `git tag` on your own.** Leave all
changes in the working tree and let the maintainer review and commit them.
Only commit if the user explicitly asks you to in that request.
