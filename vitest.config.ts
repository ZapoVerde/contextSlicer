import { defineConfig } from 'vitest/config';
import { mergeConfig } from 'vite';
import viteConfig from './vite.config';

// https://vitest.dev/config/
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // Include all files ending in .test.ts or .spec.ts
      include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    },
  })
);