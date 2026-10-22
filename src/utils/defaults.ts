import fs from 'node:fs';
import path from 'node:path';
import type { Architecture } from '../types.js';

const extensions = 'js,jsx,ts,tsx,mjs,cjs,mts,cts';

export function hasFrontendLayout(root: string): boolean {
  const directories = [
    'pages', 'app', 'components', 'views', 'screens', 'layouts',
    'hooks', 'use-cases', 'application', 'services', 'api', 'clients',
    'domain', 'entities', 'models',
  ];
  return directories.some(directory => fs.existsSync(path.join(root, 'src', directory))) ||
    ['main', 'index', 'bootstrap'].some(name => fs.existsSync(path.join(root, 'src', `${name}.tsx`))) ||
    ['main', 'index', 'bootstrap'].some(name => fs.existsSync(path.join(root, 'src', `${name}.jsx`)));
}

export function frontendArchitecture(root: string, options: { strict?: boolean } = {}): Architecture {
  const presentation = ['src/{pages,components,views,screens,layouts}/**', `src/app/**/*.{jsx,tsx}`];
  const application = ['src/{hooks,use-cases,application}/**', `src/app/**/action*.{js,ts}`];
  const adapters = ['src/{services,api,clients}/**', 'src/lib/{api,http}/**', `src/app/**/route.{js,ts}`];
  const domain = 'src/{domain,entities,models}';
  const tests = [`**/*.{test,spec}.{${extensions}}`, '**/{test,tests,__tests__}/**', 'cypress/**', 'e2e/**'];
  const composition = `src/{main,index,bootstrap}.{${extensions}}`;
  const strict = options.strict ?? false;
  return {
    root,
    layers: [
      { name: 'domain', files: [`${domain}/**`], allow: [] },
      { name: 'application', files: application, allow: ['domain', 'adapters'] },
      { name: 'adapters', files: adapters, allow: ['domain'] },
      { name: 'presentation', files: presentation, allow: strict ? ['domain', 'application'] : ['domain', 'application', 'adapters'] },
      { name: 'composition', files: [composition], allow: ['domain', 'application', 'adapters', 'presentation'] },
    ],
    core: [`${domain}/**`],
    roles: {
      entity: [`${domain}/**`],
      'use-case': application,
      port: ['src/{domain,application,hooks}/ports/**', `src/{domain,application,hooks}/ports.{${extensions}}`],
      adapter: adapters,
      controller: ['src/routes/**', `src/app/**/{route,action}.{${extensions}}`],
      repository: ['src/{services,api}/repositories/**'],
      view: presentation,
      presenter: ['src/presenters/**', `src/**/*.presenter.{${extensions}}`],
      composition: [composition],
      test: tests,
    },
    infrastructure: {
      framework: ['react', 'react-dom', 'vue', 'svelte', 'next', '@angular/**', 'solid-js'],
      persistence: ['localforage', 'dexie', 'idb', '@react-native-async-storage/async-storage'],
      transport: ['axios', 'ky', 'swr', '@tanstack/react-query', 'graphql-request', 'superagent', 'ofetch', 'undici'],
      platform: ['node:fs', 'node:child_process', 'node:os'],
      hardware: [],
    },
    volatile: adapters,
    contracts: [],
    immutable: [],
    tests,
    businessTests: [],
    testingApi: [],
    ignore: ['dist/**', 'build/**', 'coverage/**', '.next/**'],
    project: fs.existsSync(path.join(root, 'tsconfig.json')) ? { tsconfig: 'tsconfig.json' } : { files: ['src/**/*'] },
  };
}

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
