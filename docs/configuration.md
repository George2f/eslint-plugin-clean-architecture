# Configuration

## Compatibility

The plugin supports ESLint 8.57, 9 and 10 flat config. Node support is
`^18.18.0 || ^20.9.0 || >=21.1.0`; ESLint 10 itself requires Node 20.19+,
22.13+, or 24+. CommonJS `require()` returns the plugin directly and also exposes
named helpers. On ESLint 8, TypeScript consumers need `@types/eslint` because
ESLint 8 does not ship declarations.

## Default presets

`plugin.configs.recommended`, `strict`, and `strictest` work without settings.
Their `-type-checked` counterparts add typed/project checks and completeness
policies; configure a typed parser and lint without ESLint result caching.

Defaults are an explicit convention, not inference about arbitrary code:

| Purpose | Default paths under `src/` |
| --- | --- |
| Domain layer/component | `domain/**`, `entities/**` |
| Application layer/component | `application/**`, `use-cases/**`, `usecases/**` |
| Adapter layer/component | `adapters/**`, `infrastructure/**` |
| Presentation layer/component | `presentation/**`, `ui/**` |
| Composition | `main.*`, `bootstrap.*`, `bootstrap/**`, `composition/**` |
| Public component entries | `index.*`, `public.*` at each component root |
| Entities | `entities/**`, `domain/entities/**` |
| Ports | `ports/**` and `ports.*` directly under conventional component roots |
| Controllers | Adapter/presentation `controllers/**` |
| Repositories | Adapter `repositories/**`, `persistence/**`, `database/**` |
| Views / presenters | Presentation `views/**`, presentation/adapter `presenters/**` |
| Contracts | Application `contracts/requests/responses/models` directories; `contracts/request/response/models.*` files |
| Immutable scopes | Any `pure/**`, `immutable/**`, `pure.*`, `immutable.*` under `src/` |
| Business tests / API | `testing/business.*` or `testing/business/**`; `testing/api.*` or `testing/api/**` |

Domain has no outward layer dependencies; application may depend on domain;
adapters may depend on domain/application; presentation may depend on those three;
composition may depend on all layers. Same-layer dependencies remain allowed.
Tests match `*.test.*`, `*.spec.*`, `test/tests/__tests__` directories, and `src/testing/**`.

Built-in infrastructure classifications cover common web frameworks (Express,
Fastify, Koa, Next, React, Vue, Angular, Nest), persistence packages (pg, mysql2,
MongoDB, Mongoose, TypeORM, Sequelize, Prisma, Drizzle), transport libraries
(Node HTTP/HTTPS, Axios, Undici), and Node filesystem/process/network/OS APIs.
Corresponding adapter subdirectories also classify infrastructure.
See [exact patterns](https://github.com/George2f/eslint-plugin-clean-architecture/blob/main/src/utils/defaults.ts).

The root is ESLint's `cwd`, not the plugin import directory. A root tsconfig is
used when present; otherwise graph roots are source files under `src/`. Actors
and independent use-case labels are never inferred. Generic backend presets also
leave volatile targets explicit. Unrecognized layouts are not protected by an
imaginary mapping; use the helper below.

## Frontend profiles

`plugin.configs.frontend`, `frontend-strict`, `frontend-type-checked`, and
`frontend-strict-type-checked` use frontend conventions and work without settings:

| Purpose | Frontend paths under `src/` |
| --- | --- |
| Presentation | `pages/**`, `app/**/*.jsx`, `app/**/*.tsx`, `components/**`, `views/**`, `screens/**`, `layouts/**` |
| Application | `hooks/**`, `use-cases/**`, `application/**`, `app/**/action.*` |
| Adapters | `services/**`, `api/**`, `clients/**`, `lib/api/**`, `lib/http/**`, `app/**/route.*` |
| Domain | `domain/**`, `entities/**`, `models/**` |
| Composition | `main.*`, `index.*`, `bootstrap.*` |
| Tests | `*.test.*`, `*.spec.*`, `test/tests/__tests__`, `cypress/**`, `e2e/**` |

Next.js `app/**/route.*` handlers are adapters and `app/**/action.*` are
application, so they are not mistaken for page presentation.

Loose frontend layers:

- domain → nothing
- application → domain, adapters
- adapters → domain
- presentation → domain, application, adapters
- composition → all

Strict frontend layers remove presentation → adapters. Hooks are application and
services/api are adapters. `features/**` is intentionally unclassified; map it
explicitly if you use feature slices. Adapter folders are volatile; domain-only
`core` keeps React/Vue imports from being treated as core policy.

For custom frontend direction, call:

```js
createFrontendConfig(root, { strict: true, types: true, coverage: 'warn' })
```

The plain `frontend` presets need no TypeScript parser. JSX still needs a
JSX-capable parser supplied by your ESLint config. If no conventional frontend
folders exist, `createFrontendConfig` emits one warning instead of silently
running with dormant rules. `coverage: 'off'` suppresses that warning.

## Custom architecture

All file globs are root-relative, slash-separated, minimatch patterns. Absolute
`root` is required for explicit mappings. Negated patterns are rejected; use `ignore` for exclusions.
Package restrictions accept exact package names (including subpaths), glob
patterns, or resolved root-relative paths. Node built-ins can be named explicitly.
External-package declaration paths are recognized under `node_modules`.

| Field | Shape / purpose |
| --- | --- |
| `root` | Absolute project/workspace root |
| `layers` | `{ name, files: string[], allow: string[] }[]`; same-layer dependencies allowed; names unique; other allowed layers must exist |
| `components` | `{ name, files, public, actor?, useCase? }[]`; `public` matches resolved source entry points, not import spelling |
| `roles` | Role -> file globs: `entity`, `use-case`, `port`, `adapter`, `controller`, `repository`, `view`, `presenter`, `composition`, `test` |
| `core` | Protected business-policy file globs |
| `infrastructure` | Categories -> patterns: `framework`, `persistence`, `transport`, `platform`, `hardware` |
| `volatile` | Explicit volatile implementation patterns |
| `stable` | Exceptions overriding volatility; stable concrete dependencies remain valid |
| `contracts` | Exported-contract file globs; do not apply to every internal function |
| `immutable` | File globs intentionally forbidding mutation |
| `tests` | Test implementation file globs |
| `businessTests` | Business-rule test globs governed by testing API; do not include GUI/end-to-end tests indiscriminately |
| `testingApi` | Permitted testing API files |
| `ignore` | File globs excluded from rule evaluation and project graph |
| `project` | `{ tsconfig?: string, files?: string[], cache?: 'run' \| 'strict' }`; at least one root source required; `files` overrides tsconfig roots while retaining resolver options. `run` caches one graph per config/run; `strict` revalidates external file/package changes |
| `unresolved` | `ignore` (default) or `report`; latter selects completeness check in helper |

Ambiguous layer/component membership throws; ordering is not an escape hatch.
Roles may overlap. An absent role means no modules declared in that role.
Use `defineArchitecture()` for early validation and exported TypeScript types
for authoring; `createConfig()` validates as well.
Explicit settings replace conventions rather than merging in unexpected roles.

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfig } from '@george2f/eslint-plugin-clean-architecture';

const root = dirname(fileURLToPath(import.meta.url));

export default [createConfig({
  root,
  layers: [
    { name: 'business', files: ['lib/business/**'], allow: [] },
    { name: 'delivery', files: ['lib/delivery/**'], allow: ['business'] },
  ],
})];
```

The helper selects rules for scopes actually supplied; it does not require the
entire architecture model. Options: `level` (`recommended`, `strict`, `strictest`),
`types`, `project`, and `completeness`. Types/project checks are opt-in; the latter
requires `architecture.project`. Explicit `unresolved: 'report'` also enables its
completeness check. Inspect the returned `rules` for the exact enabled set.

## Typed and project checks

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import parser from '@typescript-eslint/parser';
import { createConfig } from '@george2f/eslint-plugin-clean-architecture';

const root = dirname(fileURLToPath(import.meta.url));
const architecture = {
  root,
  core: ['src/domain/**', 'src/application/**'],
  contracts: ['src/application/contracts/**'],
  infrastructure: { transport: ['express'], persistence: ['pg'] },
  project: { tsconfig: 'tsconfig.json' },
};

export default [{
  files: ['src/**/*.ts'],
  languageOptions: {
    parser,
    parserOptions: { project: './tsconfig.json', tsconfigRootDir: root },
  },
  ...createConfig(architecture, { level: 'strict', types: true, project: true }),
}];
```

Parser type services and architectural project scope are separate concerns.
`projectService` may replace parser `project`; both produce services used by rules.
`architecture.project` is required for graph checks even if parser has a program.
Set `allowJs` in tsconfig when JavaScript belongs in a tsconfig-driven graph.

Run all intended project files, without `--cache`. Graph construction follows
resolved local imports transitively within root, excluding `node_modules`, `dist`,
`coverage`, `.git`, and `ignore`. Workspace symlinks resolved to local source can
participate. Dependencies outside declared components are not assigned artificial
stability or component membership. Runtime network relationships are not inferred.

`project.cache` defaults to `run`: the first graph is reused for the rest of the
ESLint process, while current-file edits are still detected. External files or
package manifests changed during one long-running process require
`project.cache: 'strict'`, which revalidates contents and resolution metadata on
every graph request at extra cost. Use `strict` for editor/watch workflows.

Default resolution uses TypeScript Bundler/ESNext semantics. With tsconfig,
compiler settings determine aliases, extension substitution, and export handling.
Runtime-specific loaders/conditional exports may differ; configure the matching
tsconfig and use explicit overrides for virtual/ambient modules.

## Rule options

Options are supplied in standard ESLint rule tuples:

```js
rules: {
  'clean-architecture/main-sequence-distance': ['warn', { threshold: 0.5 }],
  'clean-architecture/no-outer-types-in-contracts': ['error', { maxTypeNodes: 4000 }],
  'clean-architecture/dependency-direction': ['error', { includeTypeOnly: false }],
}
```

- `threshold`: metrics only, 0..1. Defaults: SDP 0, SAP 0.5, distance 0.5.
- `maxTypeNodes`: contract traversal only, integer >=10, default 2000. Exhaustion
  raises explicit error; it never reports success after silently truncating.
- `includeTypeOnly`: dependency/graph checks, default true. Excluding types changes
  interpretation from source dependency enforcement toward runtime coupling.

Generic option schema validates these values. Options only affect their documented
analysis family; do not use metric thresholds to configure non-metric checks.

## Module metrics

This release intentionally adapts Ch. 14 to source modules:

- Fan-in = distinct external source files importing a component's modules.
- Fan-out = distinct external target files imported by that component.
- I = fan-out / (fan-in + fan-out); isolated components skipped by metric rules.
- A = proportion of component modules containing abstract-only declarations.
  Interfaces, type aliases, abstract classes, and bodyless declarations count.
  Runtime values, concrete classes/functions, and value re-exports do not.
- D = abs(A + I - 1).

Only dependencies between declared components contribute. SDP flags I(target)
minus I(source) above threshold. SAP flags stable (I < 0.5) components where
1 - I - A exceeds threshold. Distance flags D above threshold.
These are advisory TypeScript/module conventions, not exact class-based book metrics.

## Exceptions and adoption

Start with layer direction and public entries. Add role/infrastructure declarations,
then typed contracts, then full-project checks. Review heuristics as warnings
before using `strictest`. Use ordinary ESLint file overrides and targeted disable
comments with explanations for intentional exceptions.

To replace helper selections, spread `createConfig(...).rules` before specific
rule overrides. Multiple distinct architectural violations can occur on one
import (e.g. forbidden layer plus private entry point). For overlapping policies,
disable the broader or narrower rule explicitly rather than hiding evidence.
