import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: true,
  platform: 'node',
  dts: true,
  clean: true,
  deps: {
    neverBundle: [
      /^eslint(\/|$)/,
      /^@typescript-eslint\//,
      /^typescript$/,
    ],
  },
});
