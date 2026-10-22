# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `npm run lint` now enforces `@george2f/eslint-plugin-clean-code` strictest; CI runs the same gate.

## [0.3.0] - 2026-10-22

### Added

- `createLegacyConfig()` / `createLegacyFrontendConfig()` for ESLint 8
  `.eslintrc` setups, with scoped plugin registration and rule-ID mapping.
- `frontend-strictest`, `frontend-strictest-type-checked`, and
  `frontend-adoption` presets.
- `src/hooks/ui/**` presentation escape hatch; `src/hooks/*` remains application.
- Static frontend presets resolve the project root at lint time instead of baking
  `process.cwd()` at import; static backend/frontend presets warn when no
  conventional folders match.
- Backend `src/index.*` is treated as composition rather than application code.
- Diagnostics now include the offending source/target and allowed layers/public
  entry points.

### Changed

- Test files (`*.test.*`, `*.spec.*`, `__tests__`, `cypress`, `e2e`) are excluded
  from layer/component checks by default. Set `analyzeTests: true` to include them.
- Frontend profiles ignore type-only boundary dependencies by default. Set
  `includeTypeOnly: true` to include them.
- `no-view-data-formatting` only reports formatting calls in JSX or returned
  values and no longer fires on test fixtures, date arithmetic, or non-rendered
  helpers.
- Backend presets are now lazy and warn when their conventions match no folders.
- `createFrontendConfig()` supports `severity` and `heuristics` controls used by
  adoption/strictest presets.

## [0.2.1] - 2026-10-22

### Changed

- Added shared caches for tsconfig parsing, architecture validation, minimatch
  compilation, and module resolution.
- Project graphs are now cached per lint run instead of re-reading and hashing
  every project file on each rule/import; `project.cache: 'strict'` remains
  available for editor/watch invalidation.
- Project graph consumers fetch the graph once per file; cycle paths are cached.
- `port-ownership` now checks literal imports instead of every identifier/type
  symbol, reducing TypeScript checker overhead.

## [0.2.0] - 2026-10-22

### Added

- Generic frontend profiles: `frontend`, `frontend-strict`,
  `frontend-type-checked`, and `frontend-strict-type-checked`.
- `createFrontendConfig()` for React/Vite/Next-style pages, components, hooks,
  services, API, domain, and composition folders.
- Frontend coverage warning when no conventional frontend folders match.
- JavaScript AST paths for volatile construction/inheritance, port ownership,
  subtype rejection, and polymorphic dispatch.

### Changed

- Frontend presets classify hooks as application, services/API as adapters, and
  adapter folders as volatile; domain is the protected core.
- `frontend` is loose (pages may call services); `frontend-strict` requires
  pages/components to go through hooks/application before services.
- Backend presets retain their existing conventional layout and explicit
  volatility/actor requirements.
- `port-ownership`, volatile construction/inheritance, subtype rejection, and
  polymorphic dispatch now run without TypeScript type services.
- Preset counts grow with the newly JS-capable policies/heuristics.

## [0.1.1] - 2026-10-22

### Added

- ESLint 8.57, 9 and 10 support, with CI coverage across all three majors.
- Node 18, 20, 22 and 24 runtime coverage.
- Tag-triggered release workflow using npm trusted publishing, provenance,
  and GitHub Release notes generated from this changelog.
- `publint`, package dry-run, and ESLint version checks in CI.

### Changed

- CommonJS `require()` now returns the plugin directly while preserving
  `createConfig`, `defineArchitecture`, `rules`, and `.default`.
- Package metadata adds `author`, `sideEffects: false`, and public publish access.
- Builds are minified to reduce package size.
- The package now lints itself with its strictest applicable typed rules.
- `prefer-segregated-interfaces` ignores data-only and external library interfaces,
  reducing noise from common DTO and AST types.

### Fixed

- Public config types no longer depend on a single ESLint major's config types.

## [0.1.0] - 2026-10-22

### Added

- Initial release: 31 rules covering dependency boundaries, components, contracts,
  dependency inversion, immutability, coupling metrics, and design heuristics.
- `recommended`, `strict`, and `strictest` presets plus typed/project variants.
- Architecture-aware `createConfig` helper for custom layers, roles, contracts,
  infrastructure, volatility, and project scope.
- ESM/CJS/type exports, generated `rules.json` catalog, examples, chapter coverage,
  and validation suites.
