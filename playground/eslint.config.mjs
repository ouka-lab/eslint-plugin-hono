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
];
