/**
 * @file eslint.config.js
 * @architectural-role Project Configuration
 *
 * @description
 * This is the ESLint configuration for the standalone Context Slicer project.
 *
 * It is structured as a "multi-root" configuration to handle the two distinct
 * environments within this single project:
 *
 * 1. BROWSER CODE: The '/src' directory, which contains React components and
 *    browser-specific logic. It uses the main 'tsconfig.json'.
 *
 * 2. NODE.JS CODE: The '/scripts' directory, which contains the build tools
 *    for generating the source dump. It runs in a Node.js environment and
 *    uses its own dedicated 'scripts/tsconfig.json'.
 *
 * This explicit separation is critical to prevent the linter from applying the
 * wrong set of rules (e.g., browser rules to Node.js code) and causing errors.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Global ignores for the whole project
    ignores: ["dist/**"],
  },

  // --- CONFIGURATION FOR BROWSER CODE (src folder) ---
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json', // Use the main blueprint
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 'varsIgnorePattern': '^_', 'argsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_' }],
    },
  },

  // --- CONFIGURATION FOR NODE.JS CODE (scripts folder) ---
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './scripts/tsconfig.json', // Use the scripts blueprint
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { 'varsIgnorePattern': '^_', 'argsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_' }],
    },
  }
);
