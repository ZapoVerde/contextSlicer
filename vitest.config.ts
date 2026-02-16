// vitest.config.ts at root (replace what you have)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,

    // Force Vitest to look inside src/ folders explicitly
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',              // for when cwd is package root
      '**/*.{test,spec}.{ts,tsx}',                  // fallback/default
      'packages/**/src/**/*.{test,spec}.{ts,tsx}',  // extra safety for recursive
    ],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
    ],

    // Optional: more verbose output to debug discovery
    reporters: ['default'],  // or try 'verbose' temporarily
  },
})