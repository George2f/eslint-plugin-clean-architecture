import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import { createConfig } from './dist/index.js';

const root = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  { files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } } },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: root },
    },
    ...createConfig({
      root,
      layers: [
        { name: 'types', files: ['src/types.ts'], allow: [] },
        { name: 'utils', files: ['src/utils/**'], allow: ['types'] },
        { name: 'rules', files: ['src/rules/!(*.test).ts'], allow: ['types', 'utils'] },
        { name: 'plugin', files: ['src/index.ts'], allow: ['types', 'utils', 'rules'] },
        { name: 'tests', files: ['src/**/*.test.ts', 'tests/**'], allow: ['types', 'utils', 'rules', 'plugin'] },
      ],
      tests: ['**/*.test.ts', 'tests/**'],
      ignore: ['tests/fixtures/**'],
    }, { level: 'strictest', types: true }),
  },
);
