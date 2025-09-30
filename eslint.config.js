import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ["dist/**", "vite.config.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'], // Lint both src and scripts
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    // This is the new, important part
    languageOptions: {
      parserOptions: {
        project: true, // This tells the linter to find the nearest tsconfig.json
        tsconfigRootDir: import.meta.dirname, // This tells it where to start looking
      },
      globals: {
        ...globals.browser,
        ...globals.node, // Also include Node.js globals for the scripts folder
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
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
