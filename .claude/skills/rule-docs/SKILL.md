---
name: rule-docs
description: Generates and updates the documentation for eslint-plugin-hono's rules — the per-rule pages under docs/rules/*.md and the rules table in README.md — by reading rule metadata out of the built plugin. Use this whenever a rule is added, removed, or renamed; whenever a rule's severity, config membership, options schema, or fixability changes; whenever the README rules table looks stale or out of sync; and whenever someone asks to document a rule, write docs for a rule, or refresh the rules table. Reach for it even when the request is phrased as just "add a rule" — a new rule is not finished until its docs page and table row exist.
---

# Rule documentation

Every rule in this plugin has a page at `docs/rules/<rule-name>.md` and a row in the README rules table. Both are hand-written prose over machine-known facts: the prose (what the rule catches, why it matters, before/after examples) needs judgment, while the facts (which config enables it, at what severity, whether it has a fixer, what the doc URL is) are already in the rule's `meta` and should never be transcribed by hand.

`scripts/sync-rule-docs.mjs` handles the facts. You handle the prose.

## Boundaries

**This workflow does not touch `src/`.** Documentation is downstream of the rules, never the other way around. If a rule's `meta.docs.description` reads awkwardly, or a message ID is unclear, say so in your summary and let the maintainer decide — don't edit `src/rules/*.ts` or `src/index.ts` to make the docs come out nicer. `meta.docs.description` is terminal output for someone reading ESLint's console; the docs and README table are prose for someone reading GitHub. They must agree in substance, but they are allowed to differ in wording, and the script is built around that: it preserves whatever description is already in the README and only seeds one from `meta` for a rule that has no row yet.

The one thing that *is* shared: the doc URL comes from the `RuleCreator` in `src/utils.ts`, so `meta.docs.url` and the README link are the same string by construction. Never hardcode a docs URL — read it from the metadata.

`docs/` must stay out of the published package. `package.json` limits `files` to `["dist"]`, so the pages are GitHub-only and links to them are absolute `https://github.com/...` URLs rather than relative paths — that way they still resolve on the npm page.

## Workflow

### 1. Build, then read the metadata

The script imports `dist/index.mjs`, so the build has to reflect the current source:

```bash
npm run build
node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --json
```

The JSON gives you, per rule: `name`, `description`, `url`, `docFile`, `type`, `inRecommended`, `severityInAll`, `fixable`, `hasOptions`, `messageIds` — plus `missing` (rules with no doc page), `orphaned` (doc pages with no rule), `seeded`, and `tableInSync`. Run without `--json` for a readable summary.

Trust these values over anything you infer from reading the source.

### 2. Write or update the doc pages

For each rule in `missing`, and for any rule whose behavior changed, write `docs/rules/<name>.md` from `assets/rule-doc-template.md`.

Read the rule's implementation and, more importantly, **its test file** (`src/rules/<name>.test.ts`). The `invalid` cases are the incorrect examples and the `valid` cases are the correct ones — they are already known to be accurate, which is why they make much better documentation than examples you invent. Prefer the case that shows the most characteristic mistake, not the most elaborate one.

Filling the template:

- `{{RULE_NAME}}` — the rule name, under a `# hono/<name>` heading.
- `{{ONE_LINE_DESCRIPTION}}` — one sentence, same substance as `meta.docs.description`, but written for a reader: wrap identifiers in backticks (`c.req.param()`, `next()`, `HTTPException`).
- `{{STATUS_LINES}}` — derived from the metadata, one per line:
  - `inRecommended` → ``✅ Enabled in the `recommended` and `all` configs (🚨 `error`).`` — swap in ``⚠️ `warn` `` when `severityInAll` is `warn`.
  - otherwise → ``⚙️ Enabled in the `all` config only (⚠️ `warn`).``
  - `fixable` → add ``🔧 Automatically fixable by the `--fix` CLI option.``
- `{{WHY_SECTION}}` — one to three sentences on the failure this prevents. Say what actually goes wrong at runtime (a hanging request, a 404, a thrown "next() called multiple times") rather than restating the rule name. If the rule is stylistic or runtime-specific, note that here so readers understand why it is not in `recommended`.
- `{{OPTIONS_JSON}}` / `{{OPTIONS_PROSE}}` — **drop the entire `## Options` section when `hasOptions` is false.** When true, show the options object as it would appear in `eslint.config.js`, then describe each key, its type, whether it is optional, and its default. Read `defaultOptions` and the `schema` in the source for the real values.
- `{{INCORRECT_EXAMPLE}}` / `{{CORRECT_EXAMPLE}}` — runnable snippets. A rule with several distinct failure modes can repeat the Incorrect/Correct pair under bold sub-labels (see `docs/rules/route-grouping.md`, which does this for path grouping, method order, and instance grouping).

Keep the closing `[← Back to all rules](../../README.md#rules)` link.

### 3. Sync the README table

```bash
node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --write
```

This rewrites the table under `## Rules` in place: one row per rule, ordered `recommended` first (in the order `configs.recommended` declares them) then the `all`-only rules, with links, ✅, severity, and 🔧 filled from the metadata.

If the script reports rules under "Descriptions seeded from meta.docs.description", those rows now hold raw terminal wording. Edit the README to add backticks around identifiers and any clarifying detail — for example `Disallow unused calls to Context response methods` reads better in the table as ``Disallow unused calls to Context response methods (`c.json`, `c.text`, etc.)``. Don't fix this by editing the rule.

Nothing else in the README is the script's business. The prose under the table explaining why `recommended` is deliberately narrow is maintained by hand; revisit it only when a rule moves between configs.

### 4. Verify

```bash
node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --check   # 0 = table in sync, no missing/orphaned docs
npm test && npm run lint
npm pack --dry-run --json | grep '"path"'                          # docs/ must not appear
```

`--check` is the same audit with a non-zero exit code, so it also works as a CI step.

Then report which pages you created or changed, and flag anything you noticed in the rule source that you deliberately left alone.

## Removing or renaming a rule

Deleting the rule from `src` leaves its page behind; the script lists it under `orphaned`. Delete those files, run `--write` to drop the row, and grep the remaining docs for links to the old name — the template's back-link is relative, but cross-references between rule pages are not.
