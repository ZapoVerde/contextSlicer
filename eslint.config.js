import tseslint from 'typescript-eslint';

export default [
  // This line includes all the standard recommended rules
  ...tseslint.configs.recommended,
  
  // This next section adds our custom exception
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { 'argsIgnorePattern': '^_' } // This tells the linter to ignore unused variables starting with _
      ],
    },
  },
];
