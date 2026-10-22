import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { createConfig } from './dist/index.js';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  { files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } } },
  {
    files: ['src/**/*.ts'],
    ...createConfig({
      root: import.meta.dirname,
      layers: [
        { name: 'types', files: ['src/types.ts'], allow: [] },
        { name: 'utils', files: ['src/utils/**'], allow: ['types'] },
        { name: 'rules', files: ['src/rules/**'], allow: ['types', 'utils'] },
        { name: 'plugin', files: ['src/index.ts'], allow: ['types', 'utils', 'rules'] },
      ],
      tests: ['**/*.test.ts', 'tests/**'],
    }),
  },
);
