# eslint-plugin-clean-architecture

31 configurable ESLint checks derived from Robert C. Martin's *Clean Architecture*:
dependency direction, component boundaries, typed contracts, dependency inversion,
immutability, coupling metrics, and clearly labeled design heuristics.

**Explicit architecture, not guessed architecture.** You declare layers,
components, roles, and infrastructure. Rules enforce that declaration. They do
not prove that your business design is correct or prescribe four folders.

## Install

```sh
npm install --save-dev @george2f/eslint-plugin-clean-architecture eslint
# For TypeScript-aware checks:
npm install --save-dev @typescript-eslint/parser
```

Node >=20.19 and ESLint 9. TypeScript and minimatch are runtime dependencies.
Both ESM and CommonJS exports are provided; CommonJS uses `.default` for the
plugin and named exports for helpers.

## Usage

```js
// eslint.config.mjs
import { createConfig } from '@george2f/eslint-plugin-clean-architecture';

export default [{
  files: ['src/**/*.{js,ts}'],
  ...createConfig({
    root: import.meta.dirname,
    layers: [
      { name: 'domain', files: ['src/domain/**'], allow: [] },
      { name: 'application', files: ['src/application/**'], allow: ['domain'] },
      { name: 'adapters', files: ['src/adapters/**'], allow: ['domain', 'application'] },
    ],
    components: [
      { name: 'domain', files: ['src/domain/**'], public: ['src/domain/index.ts'] },
      { name: 'application', files: ['src/application/**'], public: ['src/application/index.ts'] },
    ],
    core: ['src/domain/**', 'src/application/**'],
    infrastructure: { persistence: ['pg', 'prisma', 'src/adapters/database/**'] },
  }),
}];
```

For `.ts` syntax configure a TypeScript parser even when rules do not need types.
See [typed/project setup](docs/configuration.md) and the executable
[example](examples/basic/eslint.config.mjs).

## Presets and applicability

`createConfig(architecture, options)` is the recommended entry point. It selects
only rules whose declared scopes you supplied. Inspect returned `rules` to see
the exact enabled set. Unclassified files/roles are not magically protected.

| Option | Behavior |
| --- | --- |
| `level: 'recommended'` (default) | Configured policies as errors |
| `level: 'strict'` | Adds applicable heuristics and metrics as warnings |
| `level: 'strictest'` | Applicable checks all errors |
| `types: true` | Adds applicable typed checks; requires parser type services |
| `project: true` | Adds applicable graph checks; requires `architecture.project` |
| `completeness: true` | Adds literal-target/resolution checks in declared core |

`architecture.unresolved: 'report'` also selects the unresolved-target check.
`project: true` with `recommended` includes cycle checking but not advisory metrics.

The raw `plugin.configs.recommended/strict/strictest` are minimal static presets:
direction + public APIs, with actor heuristic in strict/strictest. They require
`settings['clean-architecture']` containing layers and components. They do not
claim to enable all 31 rules without your architecture. Enabling a rule manually
without its required scopes or type services throws a clear configuration error.

## Rules

- **21 configured policies:** declared boundaries, infrastructure isolation,
  contracts, DIP, mutation, and component cycles.
- **7 heuristics:** mixed actors, concrete overrides, interface segregation,
  subtype rejection/dispatch, view formatting, boundary behavior.
- **3 metrics:** stable dependencies, stable abstractions, main-sequence distance.

Full [rule specifications](docs/rules.md), [configuration](docs/configuration.md),
and [chapter-by-chapter coverage/research decisions](docs/coverage.md).
Machine-readable metadata available through package export `./rules.json`.

## Limits

- Project graph rules require full-scope lint with **ESLint result cache disabled**.
  An unchanged importer can acquire a violation when a dependency changes.
- Graph snapshots include source contents, resolution metadata, current unsaved
  source, and file/directory existence checks. Only literal dependencies are known.
- Types erased to `any`/`unknown` cannot reveal runtime implementations.
- Metrics use documented **source-module adaptations**, not the book's exact
  class counts. Thresholds are review signals, not proof of bad architecture.
- Heuristics intentionally admit false positives; use targeted overrides.
- No rule performs architectural autofixes. Move/invert dependencies deliberately.

## Development

```sh
npm ci
npm test
npm run lint
npm run verify:dist
npm run example
```

`lint` typechecks, builds, and lints the package with TypeScript's strict ESLint
rules and its own dependency rules. Tests include colocated suites for every
rule, multi-file fixtures, actual ESLint integration, and graph invalidation.

No ebook content is bundled. Rules and book references are independent
interpretations, not an official or exhaustive mechanical certification.

MIT license.
