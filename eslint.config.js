import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Global ignores
    ignores: ["dist/**", "vite.config.ts"],
  },
  // Apply the recommended base configurations
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Custom configuration for our project
  {
    files: ['src/**/*.{ts,tsx}'], // Only lint files in the src directory
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Apply recommended React rules
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',

      // Our custom override for unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          'varsIgnorePattern': '^_',
          'argsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_',
        },
      ],
    },
  }
);