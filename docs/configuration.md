# Configuration

## Architecture

All file globs are root-relative, slash-separated, minimatch patterns. Absolute
`root` is required. Negated patterns are rejected; use `ignore` for exclusions.
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
| `project` | `{ tsconfig?: string, files?: string[] }`; at least one required; `files` overrides tsconfig roots while retaining compiler resolution options |
| `unresolved` | `ignore` (default) or `report`; latter selects completeness check in helper |

Ambiguous layer/component membership throws; ordering is not an escape hatch.
Roles may overlap. An absent role means no modules declared in that role.
Use `defineArchitecture()` for early validation and exported TypeScript types
for authoring; `createConfig()` validates as well.

## Typed and project checks

```js
import parser from '@typescript-eslint/parser';
import { createConfig } from '@george2f/eslint-plugin-clean-architecture';

const architecture = {
  root: import.meta.dirname,
  core: ['src/domain/**', 'src/application/**'],
  contracts: ['src/application/contracts/**'],
  infrastructure: { transport: ['express'], persistence: ['pg'] },
  project: { tsconfig: 'tsconfig.json' },
};

export default [{
  files: ['src/**/*.ts'],
  languageOptions: {
    parser,
    parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
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
