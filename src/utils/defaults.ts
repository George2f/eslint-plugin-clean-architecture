import fs from 'node:fs';
import path from 'node:path';
import type { Architecture } from '../types.js';

export function defaultArchitecture(root: string): Architecture {
  const domain = 'src/{domain,entities}';
  const application = 'src/{application,use-cases,usecases}';
  const adapters = 'src/{adapters,infrastructure}';
  const presentation = 'src/{presentation,ui}';
  const extension = '{js,jsx,ts,tsx,mjs,cjs,mts,cts}';
  const tests = [`**/*.{test,spec}.${extension}`, '**/{test,tests,__tests__}/**', 'src/testing/**'];
  return {
    root,
    layers: [
      { name: 'domain', files: [`${domain}/**`], allow: [] },
      { name: 'application', files: [`${application}/**`], allow: ['domain'] },
      { name: 'adapters', files: [`${adapters}/**`], allow: ['domain', 'application'] },
      { name: 'presentation', files: [`${presentation}/**`], allow: ['domain', 'application', 'adapters'] },
      { name: 'composition', files: [`src/{main,bootstrap}.${extension}`, 'src/{bootstrap,composition}/**'], allow: ['domain', 'application', 'adapters', 'presentation'] },
    ],
    components: ([
      ['domain', domain], ['application', application], ['adapters', adapters], ['presentation', presentation],
    ] as const).map(([name, directory]) => ({
      name, files: [`${directory}/**`], public: [`${directory}/{index,public}.${extension}`],
    })),
    core: [`${domain}/**`, `${application}/**`],
    roles: {
      entity: ['src/entities/**', 'src/domain/entities/**'],
      'use-case': [`${application}/**`],
      port: [`src/{domain,entities,application,use-cases,usecases,adapters,infrastructure,presentation,ui}/ports/**`,
        `src/{domain,entities,application,use-cases,usecases,adapters,infrastructure,presentation,ui}/ports.${extension}`],
      adapter: [`${adapters}/**`],
      repository: [`${adapters}/{repositories,persistence,database}/**`],
      controller: [`${adapters}/controllers/**`, `${presentation}/controllers/**`],
      view: [`${presentation}/views/**`], presenter: [`${presentation}/presenters/**`, `${adapters}/presenters/**`],
      composition: [`src/{main,bootstrap}.${extension}`, 'src/{bootstrap,composition}/**'], test: tests,
    },
    infrastructure: {
      framework: ['express', 'fastify', 'koa', 'next', 'react', 'vue', '@angular/**', '@nestjs/**', `${adapters}/frameworks/**`],
      persistence: ['pg', 'mysql2', 'mongodb', 'mongoose', 'typeorm', 'sequelize', 'prisma', '@prisma/client', 'drizzle-orm', `${adapters}/{repositories,persistence,database}/**`],
      transport: ['node:http', 'node:https', 'axios', 'undici', `${adapters}/{http,transport}/**`],
      platform: ['node:fs', 'node:child_process', 'node:net', 'node:os', `${adapters}/platform/**`],
      hardware: [`${adapters}/hardware/**`],
    },
    contracts: [`${application}/{contracts,requests,responses,models}/**`, `${application}/{contracts,request,response,models}.${extension}`],
    immutable: ['src/**/{immutable,pure}/**', `src/**/{immutable,pure}.${extension}`],
    tests,
    businessTests: [`src/testing/business.${extension}`, 'src/testing/business/**'],
    testingApi: [`src/testing/api.${extension}`, 'src/testing/api/**'],
    project: fs.existsSync(path.join(root, 'tsconfig.json')) ? { tsconfig: 'tsconfig.json' } : { files: ['src/**/*'] },
  };
}
