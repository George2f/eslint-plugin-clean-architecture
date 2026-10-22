import parser from '@typescript-eslint/parser';
import { createConfig } from '../../dist/index.js';

export default [{
  files: ['**/*.ts'],
  languageOptions: {
    parser,
    parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
  },
  ...createConfig({
    root: import.meta.dirname,
    layers: [
      { name: 'domain', files: ['src/domain/**'], allow: [] },
      { name: 'application', files: ['src/application/**'], allow: ['domain'] },
      { name: 'adapters', files: ['src/adapters/**'], allow: ['domain', 'application'] },
      { name: 'main', files: ['src/main.ts'], allow: ['domain', 'application', 'adapters'] },
    ],
    components: [
      { name: 'domain', files: ['src/domain/**'], public: ['src/domain/index.ts'] },
      { name: 'application', files: ['src/application/**'], public: ['src/application/index.ts'], useCase: 'quote' },
      { name: 'adapters', files: ['src/adapters/**'], public: ['src/adapters/index.ts'] },
    ],
    core: ['src/domain/**', 'src/application/**'],
    infrastructure: { persistence: ['src/adapters/**'] },
    volatile: ['src/adapters/**'],
    roles: { port: ['src/domain/ports.ts'], repository: ['src/adapters/repository.ts'], composition: ['src/main.ts'] },
    contracts: ['src/application/models.ts'], immutable: ['src/domain/policy.ts'],
    project: { tsconfig: 'tsconfig.json' },
  }, { types: true, project: true, completeness: true }),
}];
