# eslint-plugin-clean-architecture

[![npm version](https://img.shields.io/npm/v/@george2f/eslint-plugin-clean-architecture?logo=npm)](https://www.npmjs.com/package/@george2f/eslint-plugin-clean-architecture)
[![CI](https://github.com/George2f/eslint-plugin-clean-architecture/actions/workflows/ci.yml/badge.svg)](https://github.com/George2f/eslint-plugin-clean-architecture/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

ESLint rules derived from [Clean Architecture](https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-structure-9780134494166) by Robert C. Martin.

Every rule maps to book chapters and principles in its metadata, so a lint report
points back to the architectural idea it checks.

- 31 rules: dependency boundaries, components, SOLID signals, contracts, and immutability.
- Generic frontend profiles for React/Vite/Next-style `pages`/`components`/`hooks`/`services` layouts.
- All 34 chapters mapped, including documented limits and non-detectable guidance.
- ESLint 8.57, 9 and 10 flat config; JavaScript and TypeScript; dual ESM/CJS build.

## Why this exists

Architectural boundaries are easy to agree on and easy to break with one import.
This plugin turns the checkable parts of Clean Architecture into build-time
feedback. Start with a preset; customize the boundaries when your layout differs.

## Install

```sh
npm install --save-dev eslint @george2f/eslint-plugin-clean-architecture
```

Requires Node `^18.18.0 || ^20.9.0 || >=21.1.0` and ESLint `8.57`, `9` or `10`.
TypeScript and minimatch are runtime dependencies.

| ESLint | Node | Notes |
| --- | --- | --- |
| 8.57 | 18.18+ | Flat config; TypeScript users need `@types/eslint` |
| 9 | 18.18+ | |
| 10 | 20.19+, 22.13+, or 24+ | |

## Usage

```js
// eslint.config.mjs
import cleanArchitecture from '@george2f/eslint-plugin-clean-architecture';

export default [
  cleanArchitecture.configs.recommended,
  // cleanArchitecture.configs.strict,     // adds heuristic warnings
  // cleanArchitecture.configs.strictest,  // same checks, all errors
];
```

No architecture settings required for the presets. They use documented conventions
under `src/`: `domain`/`entities`, `application`/`use-cases`/`usecases`,
`adapters`/`infrastructure`, and `presentation`/`ui`. Public component entry points
are `index.*` or `public.*`. Other layouts need [custom mappings](docs/configuration.md#custom-architecture).

CommonJS returns the plugin directly, with named helpers also available:

```js
const cleanArchitecture = require('@george2f/eslint-plugin-clean-architecture');
const { createConfig } = require('@george2f/eslint-plugin-clean-architecture');

module.exports = [cleanArchitecture.configs.recommended];
```

Or pick rules individually:

```js
import cleanArchitecture from '@george2f/eslint-plugin-clean-architecture';

export default [{
  plugins: { 'clean-architecture': cleanArchitecture },
  rules: {
    'clean-architecture/dependency-direction': 'error',
    'clean-architecture/no-core-infrastructure': 'error',
  },
}];
```

### TypeScript

For TypeScript syntax, add your usual TypeScript parser configuration to the base
preset. For type-aware contract/DIP checks and project graphs, use a `-type-checked`
preset:

```sh
npm install --save-dev @typescript-eslint/parser
```

```js
import parser from '@typescript-eslint/parser';
import cleanArchitecture from '@george2f/eslint-plugin-clean-architecture';

export default [{
  ...cleanArchitecture.configs['strict-type-checked'],
  files: ['src/**/*.ts'],
  languageOptions: { parser, parserOptions: { projectService: true } },
}];
```

Typed presets require a tsconfig covering the files and full-scope lint **without
`--cache`**. They use the root tsconfig for resolution when present, otherwise
discover source files under `src/`.

On ESLint 8, TypeScript projects additionally need `@types/eslint`, because ESLint
8 does not ship its own type declarations.

### Frontend profiles

For a generic React/Vite/Next-style layout, use a frontend preset instead of
describing backend layers:

```js
import cleanArchitecture from '@george2f/eslint-plugin-clean-architecture';

export default [
  cleanArchitecture.configs.frontend,              // loose, AST-only
  // cleanArchitecture.configs['frontend-strict'], // pages -> hooks -> services
  // cleanArchitecture.configs['frontend-type-checked'],
  // cleanArchitecture.configs['frontend-strict-type-checked'],
];
```

Default frontend meaning:

| Layer | Conventional folders |
| --- | --- |
| presentation | `src/pages`, `src/app/**/*.{jsx,tsx}`, `src/components`, `src/views`, `src/screens`, `src/layouts` |
| application | `src/hooks`, `src/use-cases`, `src/application`, `src/app/**/action.*` |
| adapters | `src/services`, `src/api`, `src/clients`, `src/lib/api`, `src/lib/http`, `src/app/**/route.*` |
| domain | `src/domain`, `src/entities`, `src/models` |
| composition | `src/main.*`, `src/index.*`, `src/bootstrap.*` |

Loose mode allows presentation to call adapters (`pages` → `services`) directly.
Strict mode requires presentation to go through application (`pages` → `hooks` →
`services`). Both always forbid adapters importing presentation/application, and
application importing presentation. Hooks are treated as application; override
this if your hooks are presentational. `features/**` is not classified by default.

If no conventional frontend folders exist, `createFrontendConfig` warns instead
of silently reporting zero findings. Use `createFrontendConfig(root, { strict,
types })` when the layout or direction differs. For JS-only projects, the plain
frontend presets require no TypeScript parser or type information. JSX files
still need a JSX-capable parser supplied by your ESLint config.

### JavaScript

JavaScript gets every AST rule, including `no-volatile-construction`,
`no-volatile-inheritance`, `port-ownership`, `no-subtype-rejection`, and
`prefer-polymorphic-dispatch` through literal-import and local-class analysis.
TypeScript improves precision for DIP/ports and validates exported contracts.
Contract/interface rules (`no-outer-types-in-contracts`, `no-entity-boundary-data`,
`boundary-model-dependencies`, `prefer-segregated-interfaces`,
`no-concrete-method-override`, `no-behavior-in-boundary-models`) remain
TypeScript-only because JavaScript has no reliable type shape to analyze.

## Presets and applicability

| Config | Enabled rules | Severity |
| --- | --- | --- |
| `recommended` | 12 AST policies | Errors |
| `strict` | 16 AST checks | Policy errors, heuristic warnings |
| `strictest` | 16 AST checks | All errors |
| `recommended-type-checked` | 18 policies, including typed and project checks | Errors |
| `strict-type-checked` | 28 checks, including heuristics and metrics | Policy errors, other warnings |
| `strictest-type-checked` | 28 checks | All errors |
| `frontend` | 7 loose AST policies | Errors |
| `frontend-strict` | 10 strict AST checks | Policy errors, heuristic warnings |
| `frontend-type-checked` | 9 loose checks, including typed heuristics | Policy errors, heuristic warnings |
| `frontend-strict-type-checked` | 12 strict checks, including typed heuristics | Policy errors, heuristic warnings |

The generic backend presets require **explicit volatile targets**; frontend
profiles classify adapter folders as volatile. Actors and independent use-case
labels are always explicit, never guessed. Immutable checks apply only to
conventional `pure`/`immutable` files or directories; contract checks only to
designated model paths. Unmatched paths are not silently treated as core.

`createConfig(architecture, options)` remains available for custom layouts, actor
labels, volatility, and selectively enabling all 31 rules. See
[configuration](docs/configuration.md) and the [working example](examples/basic/eslint.config.mjs).

## Rules

- **21 configured policies:** declared boundaries, infrastructure isolation,
  contracts, DIP, mutation, and component cycles.
- **7 heuristics:** mixed actors, concrete overrides, interface segregation,
  subtype rejection/dispatch, view formatting, boundary behavior.
- **3 metrics:** stable dependencies, stable abstractions, main-sequence distance.

Full [rule specifications](docs/rules.md), [configuration](docs/configuration.md),
and [chapter-by-chapter coverage/research decisions](docs/coverage.md).

### Book-derived rules

| Rule | Chapters | Tier | Analysis |
| --- | --- | --- | --- |
| [`dependency-direction`](docs/rules.md#dependency-direction) | 18, 19, 22 | Policy | AST |
| [`component-public-api`](docs/rules.md#component-public-api) | 12, 17, 34 | Policy | AST |
| [`no-core-infrastructure`](docs/rules.md#no-core-infrastructure) | 20, 21, 29–32 | Policy | AST |
| [`no-composition-root-dependency`](docs/rules.md#no-composition-root-dependency) | 26 | Policy | AST |
| [`no-production-test-dependency`](docs/rules.md#no-production-test-dependency) | 28 | Policy | AST |
| [`use-case-isolation`](docs/rules.md#use-case-isolation) | 16 | Policy | AST |
| [`no-controller-repository-access`](docs/rules.md#no-controller-repository-access) | 34 | Policy | AST |
| [`humble-view-dependencies`](docs/rules.md#humble-view-dependencies) | 23 | Policy | AST |
| [`testing-api-boundaries`](docs/rules.md#testing-api-boundaries) | 28 | Policy | AST |
| [`no-volatile-concrete-dependency`](docs/rules.md#no-volatile-concrete-dependency) | 11 | Policy | AST |
| [`no-dynamic-boundary-dependencies`](docs/rules.md#no-dynamic-boundary-dependencies) | 18, 22 | Policy | AST |
| [`no-unresolved-boundary-dependencies`](docs/rules.md#no-unresolved-boundary-dependencies) | 18, 22 | Policy | AST |
| [`no-component-cycles`](docs/rules.md#no-component-cycles) | 14 | Policy | Project |
| [`no-volatile-construction`](docs/rules.md#no-volatile-construction) | 11, 26 | Policy | AST + types |
| [`no-volatile-inheritance`](docs/rules.md#no-volatile-inheritance) | 11, 32 | Policy | AST + types |
| [`port-ownership`](docs/rules.md#port-ownership) | 11, 22 | Policy | AST |
| [`no-outer-types-in-contracts`](docs/rules.md#no-outer-types-in-contracts) | 20, 22 | Policy | Types |
| [`no-entity-boundary-data`](docs/rules.md#no-entity-boundary-data) | 20, 22 | Policy | Types |
| [`boundary-model-dependencies`](docs/rules.md#boundary-model-dependencies) | 20, 22, 30, 31 | Policy | Types |
| [`no-mutation-in-immutable-modules`](docs/rules.md#no-mutation-in-immutable-modules) | 6 | Policy | AST |
| [`no-mutable-module-state`](docs/rules.md#no-mutable-module-state) | 6 | Policy | AST |
| [`no-concrete-method-override`](docs/rules.md#no-concrete-method-override) | 11 | Heuristic | Types |
| [`no-mixed-actor-dependencies`](docs/rules.md#no-mixed-actor-dependencies) | 7, 13 | Heuristic | AST |
| [`no-view-data-formatting`](docs/rules.md#no-view-data-formatting) | 23 | Heuristic | AST |
| [`prefer-segregated-interfaces`](docs/rules.md#prefer-segregated-interfaces) | 10, 13 | Heuristic | Types |
| [`no-subtype-rejection`](docs/rules.md#no-subtype-rejection) | 9 | Heuristic | AST |
| [`prefer-polymorphic-dispatch`](docs/rules.md#prefer-polymorphic-dispatch) | 5, 8, 9 | Heuristic | AST |
| [`no-behavior-in-boundary-models`](docs/rules.md#no-behavior-in-boundary-models) | 20, 22 | Heuristic | Types |
| [`stable-dependencies`](docs/rules.md#stable-dependencies) | 14 | Metric | Project |
| [`stable-abstractions`](docs/rules.md#stable-abstractions) | 14 | Metric | Project |
| [`main-sequence-distance`](docs/rules.md#main-sequence-distance) | 14 | Metric | Project |

### Machine-readable rule catalog

The package ships `rules.json`, importable as
`@george2f/eslint-plugin-clean-architecture/rules.json`: book references, tiers,
analysis prerequisites, preset membership, schemas, and limitations. Useful for
tooling and coding agents.

## Options

Rule options use standard ESLint tuples. For example, in an appropriate preset:

```js
rules: {
  'clean-architecture/dependency-direction': ['error', { includeTypeOnly: false }],
  'clean-architecture/main-sequence-distance': ['warn', { threshold: 0.5 }],
}
```

See [option definitions](docs/configuration.md#rule-options).

## Autofix and suggestions

No architectural autofixes. Moving imports, extracting ports, or changing ownership
can change runtime behavior; diagnostics explain the violated boundary instead.

## Limits

- Preset strictness controls severity, not coverage. Rules without matching
  scopes/files remain dormant. Use frontend profiles or explicit mappings.
- Project graph rules require full-scope lint with **ESLint result cache disabled**.
  They use a run-scoped graph cache by default; use `project.cache: 'strict'` for
  editor/watch workflows that must see external files change mid-process.
- Graph snapshots include source contents, resolution metadata, current unsaved
  source, and file/directory existence checks. Only literal dependencies are known.
- Types erased to `any`/`unknown` cannot reveal runtime implementations.
- Metrics use documented **source-module adaptations**, not the book's exact
  class counts. Thresholds are review signals, not proof of bad architecture.
- Heuristics intentionally admit false positives; use targeted overrides.
- No rule performs architectural autofixes. Move/invert dependencies deliberately.

## Releasing

Published from CI with npm trusted publishing (OIDC); no tokens are stored.

1. Bump `version` in `package.json` and add a changelog entry.
2. Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `.github/workflows/release.yml` lints, tests, validates the package, creates a
   GitHub Release from the matching changelog section, and publishes with provenance.

One-time setup: on npmjs.com, configure the package's trusted publisher as GitHub
Actions, repository `George2f/eslint-plugin-clean-architecture`, workflow
`release.yml`.

## Development

```sh
npm ci
npm test
npm run lint
npm run verify:dist
npm run example
```

`lint` typechecks, builds, and lints the package with TypeScript's strict ESLint
rules and the plugin's strictest applicable typed checks. CI covers Node
18/20/22/24 and ESLint 8.57/9/10. Tests include colocated suites for every rule,
multi-file fixtures, actual ESLint integration, and graph invalidation.

No ebook content is bundled. Rules and book references are independent
interpretations, not an official or exhaustive mechanical certification.

## License

[MIT](LICENSE).
