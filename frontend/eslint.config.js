import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: ['dist', 'create-og-image.js'],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            eslintReact.configs['recommended-typescript'],
            eslintReact.configs['disable-rsc'],
        ],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            'react-refresh': reactRefresh,
        },
        rules: {
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@eslint-react/no-array-index-key': 'off',
        },
    },
    {
        files: ['**/__tests__/**', '**/-tests/**', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            '@eslint-react/component-hook-factories': 'off',
        },
    },
    {
        files: ['*.config.js', '*.config.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
);
