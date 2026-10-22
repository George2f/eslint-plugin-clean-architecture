# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
