module.exports = {
    root: true,
    env: {
      browser: true,
      es2022: true,
      node: true,
    },
    extends: [
      'eslint:recommended',
      '@typescript-eslint/recommended',
      'next/core-web-vitals',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:jsx-a11y/recommended',
      'plugin:mdx/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: [
      'react',
      'react-hooks',
      '@typescript-eslint',
      'jsx-a11y',
    ],
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
      
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      
      // General rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      
      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
        },
      ],
      
      // Accessibility rules
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          components: ['Link'],
          specialLink: ['hrefLeft', 'hrefRight'],
          aspects: ['invalidHref', 'preferButton'],
        },
      ],
      
      // Formatting rules (handled by Prettier, but keeping some basic ones)
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'es5'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {},
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.mdx'],
        },
      },
    },
    overrides: [
      {
        files: ['*.mdx'],
        parser: 'eslint-mdx',
        rules: {
          // MDX specific rules
          'react/jsx-no-undef': 'off',
          '@typescript-eslint/no-unused-vars': 'off',
          'no-unused-vars': 'off',
        },
      },
      {
        files: ['*.md'],
        rules: {
          // Markdown files
          'no-unused-vars': 'off',
          '@typescript-eslint/no-unused-vars': 'off',
        },
      },
      {
        files: ['next.config.js', 'tailwind.config.js', '.eslintrc.js'],
        rules: {
          // Config files
          '@typescript-eslint/no-var-requires': 'off',
          'no-undef': 'off',
        },
      },
      {
        files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
        env: {
          jest: true,
        },
        rules: {
          // Test files
          'no-console': 'off',
          '@typescript-eslint/no-explicit-any': 'off',
        },
      },
    ],
    ignorePatterns: [
      'node_modules/',
      '.next/',
      'out/',
      'dist/',
      'build/',
      '*.min.js',
      'public/',
    ],
  };