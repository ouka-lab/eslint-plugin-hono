import tseslint from 'typescript-eslint';
import hono from 'eslint-plugin-hono';

/**
 * Every rule is enabled via `hono.configs.all` so a sample that accidentally
 * trips a rule other than its own shows up in the output. Nothing else is
 * enabled: the samples are deliberately broken Hono code, and unrelated
 * stylistic or type-aware complaints would only bury the hono/* findings.
 */
export default [
  { ignores: ['node_modules'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    ...hono.configs.all,
    files: ['src/**/*.ts'],
  },
  {
    // hono-instance-name has no convention by default, so with `all` it would
    // warn "no naming convention is enforced" in every sample. Its own sample
    // configures one inline instead.
    files: ['src/**/*.ts'],
    ignores: ['src/hono-instance-name.ts'],
    rules: {
      'hono/hono-instance-name': 'off',
    },
  },
];
