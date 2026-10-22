import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import cleanCode from '@george2f/eslint-plugin-clean-code';
import { createConfig } from './dist/index.js';

const root = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  { files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } } },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ...cleanCode.configs.strictest,
    rules: {
      ...cleanCode.configs.strictest.rules,
      // Parser/checker traversal is inherently larger than application code.
      // Keep the limits close to observed sizes so regressions still fail.
      'clean-code/max-arguments': ['error', { max: 6 }],
      'clean-code/function-does-one-thing': ['error', { maxStatements: 40, maxLines: 100 }],
      'clean-code/declaration-proximity': ['error', { maxDistance: 40 }],
      'clean-code/encapsulate-conditionals': ['error', { maxLogicalOperators: 10 }],
      'clean-code/no-feature-envy': ['error', { minimumAccesses: 9 }],
      'clean-code/one-level-of-abstraction': ['error', { minLowLevelOps: 20, minHighLevelCalls: 200 }],
      'clean-code/law-of-demeter': ['error', { maxChainLength: 6 }],
      'clean-code/long-names-for-long-scopes': ['error', {
        allow: ['i', 'j', 'k', 'x', 'y', 'z', 'e', '_', 'it', 'fs', 'os', 'vi'],
      }],
      'clean-code/no-magic-numbers': ['error', {
        ignore: [0, 1, 2, -1, 0.5, 2000, 18003],
        ignoreDefaultValues: true,
        ignoreArrayIndexes: false,
        ignoreEnums: true,
      }],
    },
  },
  {
    // Rule metadata and test fixtures use book chapter numbers, not magic values.
    files: ['src/rules/**/*.ts', 'src/**/*.test.ts', 'src/utils/metric-rule.ts'],
    rules: { 'clean-code/no-magic-numbers': 'off' },
  },
  {
    // These utilities own deliberate caches, resolvers, and visitor switches.
    files: ['src/utils/config.ts', 'src/utils/dependencies.ts', 'src/utils/project.ts'],
    rules: {
      'clean-code/command-query-separation': 'off',
      'clean-code/no-selector-arguments': 'off',
      'clean-code/no-flag-arguments': 'off',
    },
  },
  {
    // The scope walker builds a shared lookup table by design.
    files: ['src/utils/project.ts'],
    rules: { 'clean-code/no-output-arguments': 'off' },
  },
  {
    // Integration tests assert multi-part outcomes and use numeric fixtures.
    files: ['tests/**/*.ts'],
    rules: {
      'clean-code/one-assertion-per-test': ['error', { maxAssertions: 10 }],
      'clean-code/no-magic-numbers': 'off',
      'clean-code/no-duplication': 'off',
      'clean-code/command-query-separation': 'off',
      'clean-code/use-explanatory-variables': 'off',
    },
  },
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
