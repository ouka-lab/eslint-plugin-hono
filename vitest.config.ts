import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // playground/ is a separate npm project of deliberately broken samples —
    // never a source of tests for this package.
    exclude: ['**/node_modules/**', '**/dist/**', 'playground/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 88,
      },
      exclude: ['playground/**'],
    },
  },
});
