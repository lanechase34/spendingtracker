import eslint from '@eslint/js';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import jest from 'eslint-plugin-jest';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { configs as tseslintConfigs } from 'typescript-eslint';

const IMPORT_RESOLVER_PROJECTS = [
    './tsconfig.app.json',
    './tsconfig.test.json',
    './e2e/tsconfig.json',
    './tsconfig.node.json',
];

export default defineConfig([
    {
        // Global ignores
        ignores: [
            '**/node_modules/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.vite/**',
            'playwright-report/**',
            'test-results/**',
            'examples/**',
            'src/mock/**',
        ],
    },

    // Base configurations
    eslint.configs.recommended,
    ...tseslintConfigs.strictTypeChecked,
    ...tseslintConfigs.stylisticTypeChecked,
    jsxA11y.flatConfigs.strict,

    // React configurations
    eslintReact.configs['strict-type-checked'],
    reactHooks.configs.flat.recommended,

    // Import/Export organization
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,

    // Disable directives must explain why
    eslintComments.recommended,
    {
        rules: {
            '@eslint-community/eslint-comments/require-description': 'error',
            '@eslint-community/eslint-comments/no-unused-disable': 'error',
        },
    },

    // Project-specific configurations
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: IMPORT_RESOLVER_PROJECTS,
                    noWarnOnMultipleProjects: true,
                },
            },
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'import/first': 'error',
            'import/newline-after-import': 'error',
            'import/no-duplicates': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@eslint-react/no-use-context': 'off',
            '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 'off',
            '@typescript-eslint/no-deprecated': 'error',
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            '@eslint-react/no-leaked-conditional-rendering': 'error',
            'import/no-cycle': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': ['error', { requireDefaultForNonUnion: true }],
            '@typescript-eslint/no-unsafe-type-assertion': 'error',
        },
    },

    // CommonJS config files (not part of any tsconfig project)
    {
        ...tseslintConfigs.disableTypeChecked,
        ...eslintReact.configs['disable-type-checked'],
        files: ['**/*.cjs'],
        rules: {
            ...tseslintConfigs.disableTypeChecked.rules,
            ...eslintReact.configs['disable-type-checked'].rules,
        },
        languageOptions: {
            sourceType: 'commonjs',
            globals: { module: 'writable', require: 'readonly', process: 'readonly' },
        },
    },

    // Playwright e2e tests + config
    {
        ...playwright.configs['flat/recommended'],
        files: ['e2e/**/*.ts', 'playwright.config.ts'],
        rules: {
            ...playwright.configs['flat/recommended'].rules,
            // Test fixtures routinely narrow types with assertions
            '@typescript-eslint/no-unsafe-type-assertion': 'off',
        },
    },

    // Jest tests
    {
        ...jest.configs['flat/recommended'],
        files: [
            'src/**/__tests__/**/*.{ts,tsx}',
            'src/**/*.test.{ts,tsx}',
            'src/**/*.spec.{ts,tsx}',
            'src/setupTests.ts',
            'src/test-utils.tsx',
        ],
        rules: {
            ...jest.configs['flat/recommended'].rules,
            ...jest.configs['flat/style'].rules,
            // Jest-aware version understands mocked methods
            '@typescript-eslint/unbound-method': 'off',
            'jest/unbound-method': 'error',
            // Mocks and fixtures routinely narrow types with assertions
            '@typescript-eslint/no-unsafe-type-assertion': 'off',
        },
    },
]);
