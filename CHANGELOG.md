# Changelog

## Unreleased

- Presets now work directly without settings, using documented folder conventions;
  typed presets add project/type checks, while custom mappings remain optional.
- Fix CI-only traversal-budget test by using an actual large-contract fixture,
  avoiding parser single-run type-program reuse after in-memory file replacement.
- Align README with clean-code: short usage, preset table, book rule catalog, and options.
- Initial 31 rules: configured architectural policies, typed contracts/DIP,
  immutable modules, project cycles/metrics, and opt-in design heuristics.
- Architecture-aware config helper, static presets, ESM/CJS/type exports,
  generated catalog, examples, coverage matrix, and validation suites.
