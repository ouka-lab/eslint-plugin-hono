---
name: rule-playground
description: Creates and audits eslint-plugin-hono's playground — the runnable Hono samples under playground/src/*.ts, one file per rule, that prove each rule fires on real code. Use this whenever a rule is added, removed, or renamed; whenever a rule's behavior, message, or options change; whenever the playground samples look stale or the audit fails; and whenever someone asks to try a rule out, verify a rule in a real Hono app, set up or refresh the playground, or check that the plugin still works against the current Hono release. Reach for it even when the request is phrased as just "add a rule" — a new rule is not finished until it has a playground sample that demonstrably triggers it.
---

# Rule playground

`playground/` is a small standalone Hono project that installs this plugin the
way a real consumer does, so every rule can be seen firing on code that
actually runs. It holds exactly one file per rule: `playground/src/<rule>.ts`.

The samples are load-bearing, not decoration. A rule whose sample no longer
triggers it has silently regressed, so the samples are written to a convention
that a script can verify:

> Every intentional violation sits directly under a `// ❌ <rule-name>: …`
> marker. Everything under `// ✅ ok` must be clean.

`scripts/audit-playground.mjs` lints the playground with the real plugin and
checks both directions of that claim. You write the samples; the script decides
whether they are honest.

## Boundaries

**This workflow does not touch `src/`.** The playground is downstream of the
rules, never the other way around. If a sample will not trigger its rule, that
is a fact about the rule — report it, don't edit `src/rules/*.ts` or
`src/index.ts` to make the sample come out nicer.

**The playground never ships.** It is a GitHub-only development aid, excluded
from every output path:

| Path | Why the playground stays out |
| :--- | :--- |
| `tsdown.config.ts` | `entry` is `src/index.ts` only |
| `package.json` | `files` is `["dist"]` |
| `tsconfig.json` | `include` is `["src"]` |
| `eslint.config.mjs` | `ignores` contains `playground` |
| `vitest.config.ts` | `test.exclude` and `coverage.exclude` contain `playground/**` |

Never add `playground` to `files`, to the tsdown entry, or to the root
`tsconfig` include. Confirm with `npm pack --dry-run` (see Verify).

**The playground is a separate npm project.** It has its own `package.json` and
`package-lock.json` and depends on the plugin through `"eslint-plugin-hono":
"file:.."`, which npm resolves as a symlink back to the repository root. The
root `package.json`, the root `package-lock.json`, and the CI `npm ci` are not
part of this workflow — do not turn the playground into an npm workspace.

Because that symlink resolves through the repository root's `node_modules`,
the playground cannot tell you whether the *published* package resolves its
runtime dependencies correctly. To check that, install a `npm pack` tarball
into an empty directory outside the repository instead.

## Layout

```
playground/
  package.json          private, type: module, depends on eslint-plugin-hono via file:..
  package-lock.json     committed — dependabot updates hono through it
  .npmrc                mirrors the root's ignore-scripts=true
  tsconfig.json         strict, noEmit
  eslint.config.mjs     typescript-eslint parser + hono.configs.all
  README.md             how to run it, and the ❌/✅ convention
  src/<rule>.ts         one file per rule
```

`eslint.config.mjs` uses `hono.configs.all` so every rule is live in every
file. That is deliberate: it is how a sample that accidentally trips a
*different* rule gets noticed. The audit reports those as warnings.

## Workflow

### 1. Build, then audit

The script imports `dist/index.mjs`, so the build has to reflect the current
source. The playground's dependencies must be installed too.

```bash
npm run build
cd playground && npm install && cd ..
node .claude/skills/rule-playground/scripts/audit-playground.mjs --json
```

The JSON gives you `rules`, `missing` (rules with no sample), `orphaned`
(samples with no rule), `parseErrors`, `unmarked` (violations reported outside
any `// ❌` block — the `// ✅` half is dirty), `staleMarkers` (a `// ❌` block
that no longer triggers its rule), `foreignHits` (another `hono/*` rule firing
in this file — a warning, not a failure), and `ok`.

Run without `--json` for a readable summary.

### 2. Write or update the samples

For each rule in `missing`, and for any rule whose behavior changed, write
`playground/src/<name>.ts` from `assets/rule-sample-template.md`.

Take the material from the rule's **test file** (`src/rules/<name>.test.ts`) —
the `invalid` cases are the ❌ half and the `valid` cases are the ✅ half. They
are already known to be accurate, which is why they beat examples you invent.
Prefer the most characteristic failure, not the most elaborate one.

The RuleTester snippets are fragments, so turn them into something that would
really run: start from `import { Hono } from 'hono'`, declare the app, and
`export default app`. Constraints:

- **Samples must type-check.** `npm run typecheck` in `playground/` reports
  zero errors. Type the app when the sample needs it — the `no-process-env`
  sample reads `c.env`, so it declares
  `new Hono<{ Bindings: { API_KEY: string } }>()`.
- **Use default options.** A rule with an options schema must fire with no
  options configured, because that is what `hono.configs.all` sets.
- **Keep each marker block unbroken.** The marker owns the lines below it up to
  the next blank line or the next marker, so a violation the rule reports on a
  later line of the same statement is still covered.
- **A rule with distinct failure modes gets one `// ❌` block per mode**, each
  labelled with what it demonstrates (see `route-grouping`, which covers
  ungrouped paths, method order, and interleaved instances).
- **Avoid tripping other rules.** If `foreignHits` shows one, reword the sample
  so the file demonstrates its own rule cleanly. If that is impossible, leave
  it and say so in your summary.

### 3. Re-audit until it is clean

```bash
node .claude/skills/rule-playground/scripts/audit-playground.mjs --check
```

`--check` is the same audit with a non-zero exit code, so it also works as a CI
step. Iterate until it exits 0.

Note that `npm run lint` inside `playground/` exits non-zero **by design** —
the samples are deliberately broken. `--check` is the pass/fail gate, not
`eslint`'s exit code.

## Removing or renaming a rule

Deleting the rule from `src` leaves its sample behind; the audit lists it under
`orphaned`. Delete those files. A renamed rule needs its sample renamed *and*
the `// hono/<name>` header, the `docs:` URL, and every `// ❌ <name>:` marker
label updated inside it.

## Verify

```bash
npm run build
node .claude/skills/rule-playground/scripts/audit-playground.mjs --check
cd playground && npm run typecheck && cd ..
npm pack --dry-run --json | grep '"path"'   # playground/ must not appear
```

Then report which samples you created or changed, and list anything the audit
flagged as `foreignHits` that you deliberately left alone.
