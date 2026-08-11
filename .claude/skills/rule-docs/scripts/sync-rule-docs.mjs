#!/usr/bin/env node
/**
 * Reads rule metadata straight out of the built plugin and keeps the README
 * rules table in sync with it.
 *
 * Loading `dist/index.mjs` instead of parsing `src/rules/*.ts` means the
 * metadata is exactly what ESLint itself sees — descriptions, `fixable`,
 * the options schema, and the per-config severities all come from one place,
 * so the table can never drift from the code.
 *
 * Usage:
 *   node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs            # status report
 *   node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --json     # metadata as JSON
 *   node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --write    # rewrite the README table
 *   node .claude/skills/rule-docs/scripts/sync-rule-docs.mjs --check    # exit 1 if out of sync (CI)
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEVERITY_LABEL = { error: '🚨 error', warn: '⚠️ warn' };

function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src', 'rules'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Could not locate the repository root (no package.json with src/rules above cwd).');
    dir = parent;
  }
}

async function loadPlugin(root) {
  const dist = join(root, 'dist', 'index.mjs');
  if (!existsSync(dist)) {
    throw new Error(`${dist} not found. Run \`npm run build\` first — this script reads metadata from the built plugin.`);
  }
  const mod = await import(pathToFileURL(dist).href);
  return mod.default ?? mod;
}

/**
 * Rules are listed recommended-first (in the order `configs.recommended`
 * declares them), then the `all`-only rules in `configs.all` order. That keeps
 * the most important rules at the top of the table without a hand-maintained
 * ordering list.
 */
function collectRules(plugin) {
  const strip = key => key.replace(/^hono\//, '');
  const recommended = Object.fromEntries(
    Object.entries(plugin.configs.recommended.rules).map(([k, v]) => [strip(k), v]),
  );
  const all = Object.fromEntries(
    Object.entries(plugin.configs.all.rules).map(([k, v]) => [strip(k), v]),
  );

  const order = [...Object.keys(recommended), ...Object.keys(all).filter(n => !(n in recommended))];

  return order.map((name) => {
    const rule = plugin.rules[name];
    if (!rule) throw new Error(`Config references "${name}" but plugin.rules has no such rule.`);
    const { docs = {}, fixable, hasSuggestions, schema, messages, type } = rule.meta ?? {};
    // meta.docs.url is produced by the RuleCreator in src/utils.ts, so the
    // table links and the URL ESLint prints in its output stay identical.
    const url = docs.url;
    if (!url) throw new Error(`Rule "${name}" has no meta.docs.url.`);
    return {
      name,
      description: docs.description ?? '',
      url,
      docFile: join('docs', 'rules', basename(new URL(url).pathname)),
      type,
      inRecommended: name in recommended,
      severityInAll: all[name] ?? null,
      fixable: fixable ?? null,
      hasSuggestions: Boolean(hasSuggestions),
      hasOptions: Array.isArray(schema) ? schema.length > 0 : Boolean(schema),
      messageIds: Object.keys(messages ?? {}),
    };
  });
}

/**
 * Pulls the prose out of the table that is already in the README.
 *
 * The wording in the table is documentation, written for a reader browsing
 * GitHub, while `meta.docs.description` is terminal output. They should agree
 * in substance but not necessarily word for word, so this script never
 * rewrites prose a human already approved — it only seeds a description for a
 * rule that has no row yet.
 */
function parseExistingDescriptions(readme) {
  const map = new Map();
  for (const line of readme.split('\n')) {
    const m = /^\|\s*\[([^\]]+)\]\([^)]*\)\s*\|([^|]*)\|/.exec(line);
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

function renderTable(rules, existing) {
  const lines = [
    '| Rule | Description | ✅ | Severity in `all` | 🔧 |',
    '| :--- | :--- | :---: | :---: | :---: |',
  ];
  for (const r of rules) {
    const cells = [
      `[${r.name}](${r.url})`,
      existing.get(r.name) ?? r.description,
      r.inRecommended ? '✅' : '',
      SEVERITY_LABEL[r.severityInAll] ?? r.severityInAll ?? '',
      r.fixable ? '🔧' : '',
    ];
    // Empty cells render as `| |` so the source stays readable when a rule
    // is not in `recommended` or has no fixer.
    lines.push(`|${cells.map(c => (c ? ` ${c} ` : ' ')).join('|')}|`);
  }
  return lines.join('\n');
}

/** Replaces the contiguous run of `|` lines inside the `## Rules` section. */
function replaceTable(readme, table) {
  const lines = readme.split('\n');
  const start = lines.findIndex(l => /^##\s+Rules\s*$/.test(l));
  if (start === -1) throw new Error('README.md has no "## Rules" heading.');

  const first = lines.findIndex((l, i) => i > start && l.startsWith('|'));
  if (first === -1) throw new Error('No table found under the "## Rules" heading in README.md.');

  let last = first;
  while (last + 1 < lines.length && lines[last + 1].startsWith('|')) last++;

  return [...lines.slice(0, first), ...table.split('\n'), ...lines.slice(last + 1)].join('\n');
}

function auditDocs(root, rules) {
  const dir = join(root, 'docs', 'rules');
  const present = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md')) : [];
  const expected = new Set(rules.map(r => basename(r.docFile)));
  return {
    missing: rules.filter(r => !existsSync(join(root, r.docFile))).map(r => r.docFile),
    orphaned: present.filter(f => !expected.has(f)).map(f => join('docs', 'rules', f)),
  };
}

const args = new Set(process.argv.slice(2));
const root = findRepoRoot();
const plugin = await loadPlugin(root);
const rules = collectRules(plugin);
const readmePath = join(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const existing = parseExistingDescriptions(readme);
const table = renderTable(rules, existing);
const updated = replaceTable(readme, table);
const tableInSync = updated === readme;
const { missing, orphaned } = auditDocs(root, rules);
// Rules whose table description was seeded from meta rather than kept from the
// README — these are the ones whose wording still wants a human/AI pass.
const seeded = rules.filter(r => !existing.has(r.name)).map(r => r.name);

if (args.has('--json')) {
  console.log(JSON.stringify({ rules, tableInSync, missing, orphaned, seeded }, null, 2));
  process.exit(0);
}

if (args.has('--write')) {
  if (tableInSync) {
    console.log('README rules table is already up to date.');
  } else {
    writeFileSync(readmePath, updated);
    console.log(`Rewrote the rules table in README.md (${rules.length} rules).`);
  }
}

console.log(`\nRules (${rules.length}):`);
for (const r of rules) {
  const flags = [
    r.inRecommended ? 'recommended' : 'all-only',
    r.severityInAll,
    r.fixable ? 'fixable' : null,
    r.hasOptions ? 'has options' : null,
    existsSync(join(root, r.docFile)) ? null : 'DOC MISSING',
  ].filter(Boolean);
  console.log(`  ${r.name.padEnd(30)} ${flags.join(', ')}`);
}

if (seeded.length) {
  console.log(`\nDescriptions seeded from meta.docs.description (review the wording):\n${seeded.map(n => `  ${n}`).join('\n')}`);
}
if (missing.length) console.log(`\nMissing docs:\n${missing.map(f => `  ${f}`).join('\n')}`);
if (orphaned.length) console.log(`\nOrphaned docs (no matching rule):\n${orphaned.map(f => `  ${f}`).join('\n')}`);
if (!args.has('--write')) console.log(`\nREADME table: ${tableInSync ? 'in sync' : 'OUT OF SYNC (run with --write)'}`);

if (args.has('--check') && (!tableInSync || missing.length || orphaned.length)) {
  console.error('\nDocs are out of sync. Run the rule-docs skill, or this script with --write.');
  process.exit(1);
}
