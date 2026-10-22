# Working on this package

- Independent ESLint 8.57/9/10 plugin derived from *Clean Architecture*, not a fork of sibling clean-code package.
- `src/rules/<name>.ts` plus colocated `.test.ts`; test cases share fixtures in `tests/`.
- `src/utils/` owns configuration, dependency collection/resolution, typed traversal, and project snapshots.
- Register rules in `src/index.ts`; update `docs/rules.md`, `docs/coverage.md`, README, and changelog.
- Every rule needs chapters, principle, analysis, reliability, scopes, limitations, and meaningful allowed/forbidden cases.
- Frontend profiles live in `src/utils/defaults.ts`; keep loose/strict direction, `hooks/ui` escape hatch, type-only default, and coverage warning aligned with README/docs.
- Test files are excluded from layer/component/role checks unless `analyzeTests: true`; keep `isTest` non-recursive.
- Static frontend presets use `settings['clean-architecture-profile']`, resolved at lint cwd; do not bake project roots into presets.
- Five rules have optional type services with AST fallbacks: volatile construction/inheritance, port ownership, subtype rejection, polymorphic dispatch. Keep JS tests.
- Never infer actors or volatility from names. Never promise purity, LSP, or business-design correctness.
- No architectural autofixes. Do not include ebook text or local ebook paths in artifacts.
- `npm test`, `npm run lint`, `npm run verify:dist`, `npm run example`, `npm pack --dry-run`, and `npx publint` are completion checks.
- Tests must stay compatible with ESLint 8.57, 9, and 10; use `tests/eslint-compat.ts` for version differences.
- Graph rules require full-scope lint without ESLint result caching; keep snapshot invalidation tests under `project.cache: 'strict'`.
- Project graphs are run-cached by default (`project.cache: 'run'`); do not add per-edge graph rebuilds.
- Metrics are documented source-module adaptations, not the book's exact class metrics.
- Releases are tag-triggered through `.github/workflows/release.yml` and npm trusted publishing; changelog notes come from `scripts/changelog-notes.mjs`.
- Do not publish, commit, or tag unless explicitly requested.
