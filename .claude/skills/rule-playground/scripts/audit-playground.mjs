#!/usr/bin/env node
/**
 * Audits the playground against the built plugin.
 *
 * The playground is one runnable Hono file per rule, and each intentional
 * violation is announced by a `// ❌ <rule-name>: …` marker on the line above
 * it. That convention is what makes the samples checkable: this script lints
 * the playground with the real plugin and then asserts that the violations
 * ESLint reports and the violations the file claims to demonstrate are the
 * same set. A sample that stops triggering its rule (or starts triggering it
 * from the `// ✅` half) is a stale sample, and stale samples are worse than
 * missing ones.
 *
 * Usage:
 *   node .claude/skills/rule-playground/scripts/audit-playground.mjs          # status report
 *   node .claude/skills/rule-playground/scripts/audit-playground.mjs --json   # findings as JSON
 *   node .claude/skills/rule-playground/scripts/audit-playground.mjs --check  # exit 1 if out of sync (CI)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { findRepoRoot, loadPlugin } from '../../../scripts/plugin-meta.mjs';

const MARKER = /^\s*\/\/\s*❌/;

function ruleNames(plugin) {
  return Object.keys(plugin.rules).sort();
}

function auditFiles(srcDir, rules) {
  const present = existsSync(srcDir)
    ? readdirSync(srcDir).filter(f => f.endsWith('.ts')).map(f => basename(f, '.ts'))
    : [];
  return {
    missing: rules.filter(r => !present.includes(r)),
    orphaned: present.filter(f => !rules.includes(f)),
  };
}

/**
 * A marker owns the lines from just below it until the next blank line or the
 * next marker, whichever comes first. Blank lines are the delimiter because
 * that is how the samples already separate the ❌ half from the ✅ half — no
 * extra end-marker for an author to forget.
 */
function markerRegions(source) {
  const lines = source.split('\n');
  const regions = [];
  let open = null;
  const close = (endLine) => {
    if (open) {
      regions.push({ ...open, end: endLine });
      open = null;
    }
  };

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (MARKER.test(line)) {
      close(lineNo - 1);
      open = { marker: lineNo, start: lineNo + 1, label: line.trim().replace(/^\/\/\s*/, '') };
      return;
    }
    if (open && line.trim() === '') close(lineNo - 1);
  });
  close(lines.length);
  return regions;
}

function runEslint(playgroundDir) {
  const bin = join(playgroundDir, 'node_modules', '.bin', 'eslint');
  if (!existsSync(bin)) {
    throw new Error(`${bin} not found. Run \`npm run build\` at the repository root, then \`npm install\` inside playground/.`);
  }
  // ESLint exits 1 when it reports errors, which is the normal state here —
  // the samples are deliberately broken. Only a crash (exit >= 2) is a problem.
  const res = spawnSync(bin, ['src', '--format', 'json'], {
    cwd: playgroundDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  if (res.status !== 0 && res.status !== 1) {
    throw new Error(`eslint exited with ${res.status}:\n${res.stderr || res.stdout}`);
  }
  try {
    return JSON.parse(res.stdout);
  }
  catch {
    throw new Error(`Could not parse eslint --format json output:\n${res.stdout}\n${res.stderr}`);
  }
}

function auditSamples(root, srcDir, rules, results) {
  const byFile = new Map(results.map(r => [r.filePath, r]));
  const findings = { unmarked: [], staleMarkers: [], foreignHits: [], parseErrors: [] };

  for (const rule of rules) {
    const file = join(srcDir, `${rule}.ts`);
    if (!existsSync(file)) continue;
    const rel = relative(root, file);
    const result = byFile.get(file);
    const messages = result?.messages ?? [];
    const regions = markerRegions(readFileSync(file, 'utf8'));

    for (const m of messages) {
      if (!m.ruleId) {
        findings.parseErrors.push({ file: rel, line: m.line, message: m.message });
        continue;
      }
      if (m.ruleId !== `hono/${rule}`) {
        findings.foreignHits.push({ file: rel, line: m.line, ruleId: m.ruleId, message: m.message });
        continue;
      }
      const covered = regions.some(r => m.line >= r.start && m.line <= r.end);
      if (!covered) {
        findings.unmarked.push({ file: rel, line: m.line, ruleId: m.ruleId, message: m.message });
      }
    }

    const own = messages.filter(m => m.ruleId === `hono/${rule}`);
    for (const r of regions) {
      const hit = own.some(m => m.line >= r.start && m.line <= r.end);
      if (!hit) findings.staleMarkers.push({ file: rel, line: r.marker, label: r.label });
    }
    if (regions.length === 0) {
      findings.staleMarkers.push({ file: rel, line: 1, label: 'no ❌ marker in this file' });
    }
  }

  return findings;
}

const args = new Set(process.argv.slice(2));
const root = findRepoRoot();
const playgroundDir = join(root, 'playground');
const srcDir = join(playgroundDir, 'src');

if (!existsSync(playgroundDir)) {
  console.error(`${relative(root, playgroundDir)}/ does not exist. See .claude/skills/rule-playground/SKILL.md.`);
  process.exit(1);
}

const plugin = await loadPlugin(root);
const rules = ruleNames(plugin);
const { missing, orphaned } = auditFiles(srcDir, rules);
const findings = auditSamples(root, srcDir, rules, runEslint(playgroundDir));
const { unmarked, staleMarkers, foreignHits, parseErrors } = findings;
const ok = !missing.length && !orphaned.length && !unmarked.length && !staleMarkers.length && !parseErrors.length;

if (args.has('--json')) {
  console.log(JSON.stringify({ rules, missing, orphaned, ...findings, ok }, null, 2));
  process.exit(ok || !args.has('--check') ? 0 : 1);
}

console.log(`\nPlayground samples (${rules.length} rules):`);
for (const rule of rules) {
  const file = join(srcDir, `${rule}.ts`);
  const flags = existsSync(file)
    ? [
        `${markerRegions(readFileSync(file, 'utf8')).length} ❌ marker(s)`,
        staleMarkers.some(s => s.file.endsWith(`${rule}.ts`)) ? 'STALE' : null,
        unmarked.some(s => s.file.endsWith(`${rule}.ts`)) ? 'UNMARKED VIOLATION' : null,
      ].filter(Boolean)
    : ['SAMPLE MISSING'];
  console.log(`  ${rule.padEnd(30)} ${flags.join(', ')}`);
}

const report = (title, rows, render) => {
  if (rows.length) console.log(`\n${title}:\n${rows.map(r => `  ${render(r)}`).join('\n')}`);
};
report('Missing samples', missing, r => `playground/src/${r}.ts`);
report('Orphaned samples (no matching rule)', orphaned, r => `playground/src/${r}.ts`);
report('Parse errors', parseErrors, r => `${r.file}:${r.line} ${r.message}`);
report('Violations outside any ❌ marker (the ✅ half is not clean)', unmarked, r => `${r.file}:${r.line} ${r.ruleId} — ${r.message}`);
report('❌ markers that no longer trigger their rule', staleMarkers, r => `${r.file}:${r.line} ${r.label}`);
report('Other hono rules firing in this file (warning only)', foreignHits, r => `${r.file}:${r.line} ${r.ruleId} — ${r.message}`);

console.log(`\nPlayground: ${ok ? 'in sync' : 'OUT OF SYNC'}`);

if (args.has('--check') && !ok) {
  console.error('\nPlayground is out of sync with the rules. Run the rule-playground skill.');
  process.exit(1);
}
