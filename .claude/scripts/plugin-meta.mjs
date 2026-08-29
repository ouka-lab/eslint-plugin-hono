/**
 * Shared helpers for the repository's skills.
 *
 * Both the `rule-docs` and `rule-playground` workflows need the same two
 * things: where the repository root is, and what ESLint actually sees when it
 * loads this plugin. Loading `dist/index.mjs` rather than parsing
 * `src/rules/*.ts` keeps rule names, descriptions and per-config severities
 * coming from a single source of truth, so neither skill can drift from the
 * code.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src', 'rules'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Could not locate the repository root (no package.json with src/rules above cwd).');
    dir = parent;
  }
}

export async function loadPlugin(root) {
  const dist = join(root, 'dist', 'index.mjs');
  if (!existsSync(dist)) {
    throw new Error(`${dist} not found. Run \`npm run build\` first — this script reads metadata from the built plugin.`);
  }
  const mod = await import(pathToFileURL(dist).href);
  return mod.default ?? mod;
}
