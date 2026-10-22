import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Architecture as ArchitectureShape } from '../src/types.js';

export const root = fileURLToPath(new URL('./fixtures/app', import.meta.url));
export const file = (name: string): string => path.join(root, 'src', name);

export const architecture: ArchitectureShape = {
  root,
  layers: [
    { name: 'domain', files: ['src/domain/**'], allow: [] },
    { name: 'application', files: ['src/application/**'], allow: ['domain'] },
    { name: 'adapters', files: ['src/adapters/**'], allow: ['domain', 'application'] },
    { name: 'ui', files: ['src/ui/**'], allow: ['domain', 'application', 'adapters'] },
  ],
  components: [
    { name: 'domain', files: ['src/domain/**'], public: ['src/domain/index.ts'] },
    { name: 'application', files: ['src/application/**'], public: ['src/application/index.ts'], useCase: 'orders' },
    { name: 'persistence', files: ['src/adapters/**'], public: ['src/adapters/index.ts'], useCase: 'billing' },
    { name: 'ui', files: ['src/ui/**'], public: ['src/ui/index.ts'] },
    { name: 'finance', files: ['src/actors/finance/**'], public: ['src/actors/finance/index.ts'], actor: 'finance' },
    { name: 'hr', files: ['src/actors/hr/**'], public: ['src/actors/hr/index.ts'], actor: 'hr' },
  ],
  roles: {
    entity: ['src/domain/entity.ts'], 'use-case': ['src/application/**'],
    port: ['src/application/ports.ts', 'src/adapters/outer-port.ts'],
    adapter: ['src/adapters/**'], repository: ['src/adapters/repository.ts'],
    controller: ['src/ui/controller.ts'], view: ['src/ui/view.ts'], presenter: ['src/ui/presenter.ts'],
    composition: ['src/main.ts'], test: ['src/testing/**'],
  },
  core: ['src/domain/**', 'src/application/**'],
  infrastructure: {
    framework: ['framework-lib', 'src/adapters/framework.ts'],
    persistence: ['database-lib', 'src/adapters/repository.ts'],
    transport: ['http-lib', 'node:http', 'src/adapters/request.ts'],
    platform: ['node:fs'], hardware: ['device-sdk'],
  },
  volatile: ['src/adapters/volatile.ts'], stable: ['src/adapters/stable.ts'],
  contracts: ['src/application/contracts*.ts'], immutable: ['src/domain/immutable.ts'],
  tests: ['src/testing/**'], businessTests: ['src/testing/business.ts'], testingApi: ['src/testing/api.ts'],
  project: { tsconfig: 'tsconfig.json' },
};
