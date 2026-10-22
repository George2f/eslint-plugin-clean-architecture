# Working on this package

- Independent ESLint 9 plugin derived from *Clean Architecture*, not a fork of sibling clean-code package.
- `src/rules/<name>.ts` plus colocated `.test.ts`; test cases share fixtures in `tests/`.
- `src/utils/` owns configuration, dependency collection/resolution, typed traversal, and project snapshots.
- Register rules in `src/index.ts`; update `docs/rules.md`, `docs/coverage.md`, and changelog.
- Every rule needs chapters, principle, analysis, reliability, scopes, limitations, and meaningful allowed/forbidden cases.
- Never infer actors or volatility from names. Never promise purity, LSP, or business-design correctness.
- No architectural autofixes. Do not include ebook text or local ebook paths in artifacts.
- `npm test`, `npm run lint`, `npm run verify:dist`, `npm run example` are completion checks.
- Graph rules require full-scope lint without ESLint result caching; keep snapshot invalidation tests.
- Metrics are documented source-module adaptations, not the book's exact class metrics.
- Do not publish, commit, or tag unless explicitly requested.
