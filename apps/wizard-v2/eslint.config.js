import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          // shadcn/ui variant helpers and the hook that pairs with ThemeProvider.
          allowExportNames: ['buttonVariants', 'tabsListVariants', 'useTheme'],
        },
      ],
      // Leading underscore marks an intentionally unused argument.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // File routes export `Route` alongside local components. The TanStack
    // router plugin (autoCodeSplitting in vite.config.ts) moves route
    // components into their own modules and handles HMR for these files.
    files: ['src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Playwright tests run in Node, not React. Fixture callbacks receive a
    // `use` function that the React hooks rules mistake for React's `use()`,
    // and Playwright requires object destructuring even when a fixture takes
    // no dependencies (`async ({}, use) => …`).
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
      'no-empty-pattern': 'off',
    },
  },
])
