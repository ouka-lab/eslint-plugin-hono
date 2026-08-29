# playground

A standalone Hono project for watching `eslint-plugin-hono` work on real code.

It is a development aid only. It is not built by `tsdown`, not covered by the
root `tsconfig`, not linted by the root ESLint config, not collected by Vitest,
and not published — `files` in the root `package.json` is limited to `["dist"]`.

## Setup

The playground consumes the plugin the way a real project does: its
`package.json` declares `"eslint-plugin-hono": "file:.."`, which npm resolves
as a symlink back to the repository root. ESLint then loads it through the
package's `exports` field, so `dist/` has to exist first.

```bash
npm run build          # in the repository root
cd playground
npm install
```

## Running it

```bash
npm run lint           # see every rule fire
npm run typecheck      # samples must have zero type errors
npm run audit          # the pass/fail gate
```

**`npm run lint` exits non-zero on purpose.** The samples are deliberately
broken Hono code — that is the point. Use `npm run audit` to decide whether the
playground is healthy.

## Layout and conventions

One file per rule, named after the rule: `src/<rule-name>.ts`.

Inside each file, every intentional violation sits directly under a marker:

```typescript
// ❌ no-process-env: process.env is not populated on Workers, Deno or Bun edge runtimes
app.get('/from-process', (c) => {
  const apiKey = process.env.API_KEY;
  return c.json({ apiKey });
});

// ✅ ok
app.get('/from-bindings', (c) => {
  const apiKey = c.env.API_KEY;
  return c.json({ apiKey });
});
```

A marker owns the lines below it up to the next blank line or the next marker.
`npm run audit` lints the playground with the real plugin and checks that:

- every rule has a sample, and every sample has a rule;
- every `// ❌` block still triggers its rule (samples cannot go stale);
- nothing outside a `// ❌` block triggers it (the `// ✅` half stays clean);
- no other `hono/*` rule fires in the file (reported as a warning).

`eslint.config.mjs` enables `hono.configs.all`, so every rule is live in every
file — that is what makes the last check meaningful.

## Adding or changing a rule

Use the `/rule-playground` skill
(`.claude/skills/rule-playground/SKILL.md`). A rule change is not finished
until `npm run audit` is clean again.
