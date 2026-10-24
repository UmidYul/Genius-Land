import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/next-env.d.ts',
      'Legacy Website Audit/**',
      '.claude/**',
      '.agents/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    // No hard-coded interface text: every visible string comes from the uz/ru dictionaries.
    files: ['apps/web/src/**/*.tsx', 'packages/ui/src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['^(aria-label|aria-description|title|alt|placeholder|label)$'],
          },
          // Arguments of translators (t, tCommon…) are dictionary keys, not interface text.
          callees: { exclude: ['^t$', '^t[A-Z]\\w*$', '^(use|get)Translations$', '^cn$'] },
          // Allow only text without letters: digits, punctuation, symbols such as "*".
          words: { exclude: ['^[\\s\\d.,:;!?*()\\[\\]{}<>/|+=_#%&@~^"\'`·—–…-]*$'] },
        },
      ],
    },
  },
  {
    // Seed and scripts print progress to the console on purpose.
    files: ['packages/db/prisma/**', 'test/**', 'e2e/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
