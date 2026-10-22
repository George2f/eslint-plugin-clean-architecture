# Rule specifications

Rule names below are plugin names, not names quoted from the book. File paths and
roles in examples must be declared in architecture settings. A “valid” example
means this detector allows it, not that the whole application is well designed.
See [configuration](configuration.md) for resolution, options, scopes, and metrics;
`dist/rules.json` contains exact chapters, prerequisites, schemas, and limitations.
None of these rules has an autofix.

## dependency-direction

Ch. 18/19/22; configured, AST. Requires `layers`.
Detects imports/re-exports/loads from one declared layer to a disallowed layer.
Valid: application imports domain when explicitly allowed. Invalid: domain
imports persistence adapter. Same-layer dependencies allowed. Unknown targets
are not inferred; enable completeness rules to expose them.

## component-public-api

Ch. 12/17/34; configured, AST. Requires `components`.
Valid: `import { Order } from '../domain/index.js'` when index is public.
Invalid: importing `../domain/internal/order.js` from another component.
Internal collaboration within the same component remains valid. Barrels must be
declared public; exporting an implementation through a public barrel is allowed.

## no-core-infrastructure

Ch. 20/21/29–32; configured, AST. Requires `core`, `infrastructure`.
Valid: core imports a domain-owned repository port. Invalid: core imports `pg`
when `pg` is classified as persistence. Categories include frameworks, transport,
platform, hardware, and persistence. Imports outside core remain valid.

## no-composition-root-dependency

Ch. 26; configured, AST. Requires `roles`.
Valid: Main imports and wires use cases. Invalid: a production use case imports
Main. Composition-to-composition collaboration and test imports are allowed.
Only designated composition files are protected.

## no-production-test-dependency

Ch. 28; configured, AST. Requires `tests`.
Valid: tests import production policy or other test helpers. Invalid: production
imports test helper. Test role declarations also classify test files, but explicit
`tests` scope is required for enabling this detector.

## use-case-isolation

Ch. 16; configured, AST. Requires `components` with `useCase` labels.
Valid: orders accesses billing's public entry point. Invalid: orders accesses
billing's private implementation. Components without use-case labels exempt.
This does not ban all cross-use-case collaboration.

## no-controller-repository-access

Ch. 34; configured, AST. Requires `roles`.
Valid: controller invokes application entry point. Invalid: controller directly
imports designated repository implementation. Roles establish policy; rule does
not guess repositories by class names.

## humble-view-dependencies

Ch. 23; configured, AST. Requires `roles`.
Valid: view depends on presenter/view model. Invalid: view directly imports
designated entity, use case, or repository. It cannot identify arbitrary business
logic embedded in view expressions.

## testing-api-boundaries

Ch. 28; configured, AST. Requires `businessTests`, `testingApi`.
Valid: designated business test accesses testing API or test helper. Invalid:
that test imports core internals or classified infrastructure directly.
Core detection requires `core`; infrastructure detection requires its categories.
Ordinary GUI/end-to-end tests are unrestricted unless explicitly designated.

## no-volatile-concrete-dependency

Ch. 11; configured, AST. Requires `core`, `volatile`.
Valid: protected policy references a stable concrete facility. Invalid: core
imports a declared volatile implementation. `stable` overrides volatility.
Declaration patterns should name implementation modules, not abstract ports.

## no-dynamic-boundary-dependencies

Ch. 18/22; configured completeness policy, AST. Requires `core`.
Valid: `import('./known.js')`. Invalid in core: `import(moduleName)`.
Shadowed `require` is not treated as module loading. Dynamic loading elsewhere
allowed. Opt-in via `completeness`, not a universal book prohibition.

## no-unresolved-boundary-dependencies

Ch. 18/22; configured completeness policy, AST. Requires `core`.
Valid: resolved local dependency or recognized Node built-in. Invalid: unresolved
target from core. Ambient/virtual modules may need overrides. Does not fabricate
a resolved target; configured package restrictions can still match import spelling.

## no-component-cycles

Ch. 14; configured, project. Requires `components`, `project`.
Valid: A -> B -> C. Invalid: A -> B -> A; report contains actual component path.
File cycles entirely inside A are not component cycles. Type dependencies count
unless `includeTypeOnly: false`. Requires full-scope lint without result cache.

## stable-dependencies

Ch. 14; metric, project. Requires `components`, `project`.
Valid: I(source)=0.8 -> I(target)=0.2. Invalid above default threshold:
I(source)=0.2 -> I(target)=0.8. `threshold` tolerates a positive difference.
Module-adapted diagnostic, not exact class-count metric or guaranteed design flaw.

## stable-abstractions

Ch. 14; metric, project. Requires `components`, `project`.
Valid: stable component containing abstract-only modules. Warn: stable concrete
component where `1 - I - A` exceeds threshold, default 0.5; considered stable
when I < 0.5. Isolated components skipped.

## main-sequence-distance

Ch. 14; metric, project. Requires `components`, `project`.
Valid: A + I near 1. Warn: abs(A + I - 1) above threshold, default 0.5.
Reports A/I/D once at lexicographically first component source file. Full lint
scope required so that reporting file participates. Isolated components skipped.

## no-volatile-construction

Ch. 11/26; configured, typed. Requires `core`, `volatile`.
Valid: constructing a stable value object. Invalid: `new Adapter()` in core when
resolved Adapter declaration is volatile, including aliased imports. Factory
results and opaque runtime injection are not reconstructed.

## no-volatile-inheritance

Ch. 11/32; configured, typed. Requires `core`, `volatile`.
Valid: protected class extends a stable permitted base. Invalid: extends a
declared volatile concrete implementation. Uses actual resolved declarations;
does not assume every abstract or framework base is volatile.

## no-concrete-method-override

Ch. 11; heuristic, typed. No additional architecture scope beyond `root`.
Valid: implementing an abstract method. Warn: overriding inherited concrete
method implementation. Constructors, static methods, and accessors excluded.
Framework hooks and intentional template methods are legitimate exceptions.

## port-ownership

Ch. 11/22; configured, typed. Requires `core`, `roles`.
Valid: policy uses port owned by its own or permitted inner layer. Invalid:
policy references designated port interface/type alias owned by forbidden outer
layer. Without layer classification, port must be in core. Interface members are
not reported again as separate ports. No names-based interface guessing.

## no-outer-types-in-contracts

Ch. 20/22; configured, typed. Requires `contracts`, `layers`.
Valid: exported request contains independent local/domain data. Invalid: inferred
exported response contains outer adapter type, even through nested properties,
unions, arrays, promises, or signatures. Does not recover types erased to any.

## no-entity-boundary-data

Ch. 20/22; configured, typed. Requires `contracts`, `roles`.
Valid: `{ orderId: string }`. Invalid: `{ order: Order }` where Order is a
designated entity, including generic nesting. Only designated contracts checked;
passing entities internally between domain functions is not globally prohibited.

## boundary-model-dependencies

Ch. 20/22/30/31; configured, typed. Requires `contracts`, `infrastructure`.
Valid: independent request/response types. Invalid: contract exposes ORM row,
HTTP request, or classified framework representation through public type graph.
External internals not expanded; their identity and generic arguments checked.

## no-mutation-in-immutable-modules

Ch. 6; configured, AST. Requires `immutable`.
Valid: derive new array with `values.map(...)`. Invalid in immutable file:
assignment, increment, deletion, or known local array/collection mutator.
Recognizes simple initializer aliases and standard constructors. Unknown calls,
parameter mutation via unknown aliases, and arbitrary native side effects are
not proven absent. A custom method named `push` is not assumed an array mutator.

## no-mutable-module-state

Ch. 6; configured, AST. Requires `immutable`.
Valid: `export const factor = 2`. Invalid: module-scope `export let count = 0`.
Checks reassignable bindings, not deep const immutability. Function-local
bindings are allowed; changing them is handled by mutation detector.

## no-mixed-actor-dependencies

Ch. 7/13; heuristic, AST. Requires `components` with explicit `actor` labels.
Valid: module depends on one actor group. Warn: dependencies span several actor
groups. Orchestration is a valid counterexample; dependencies alone do not prove
multiple reasons to change. Actor names never inferred from business identifiers.

## no-view-data-formatting

Ch. 23; heuristic, AST. Requires `roles`.
Valid: view receives formatted data; presenter calls `amount.toFixed(2)`.
Warn in view: known formatting method names such as `toFixed`, `toPrecision`,
and locale/date formatting. Method names are a review signal, not type proof.
Normal rendering, map calls, and arbitrary functions are not blanket-banned.

## prefer-segregated-interfaces

Ch. 10/13; heuristic, typed. No scope beyond `root`.
Valid: a Reader parameter whose only required member is read. Warn: consumer
statically uses one member of a broader interface without forwarding/escaping
the parameter. Destructuring, dynamic access, and forwarding skip the heuristic.
Partial usage can still be intentional. Structural TS semantics differ from Java.

## no-subtype-rejection

Ch. 9; heuristic, typed. No scope beyond `root`.
Valid: implementing operation or throwing in unrelated method. Warn: inherited
or interface operation consists solely of a throw. This may satisfy its actual
contract, so warning asks for review rather than asserting an LSP violation.

## prefer-polymorphic-dispatch

Ch. 5/8/9; heuristic, typed. No scope beyond `root`.
Valid: call `shape.area()`. Warn: same function checks same abstraction against
multiple distinct proper subtypes with instanceof. Uses assignability to reject
unrelated types; excludes Error handling and any/unknown/union left operands.
Does not prove OCP/LSP or ban every instanceof/switch.

## no-behavior-in-boundary-models

Ch. 20/22; heuristic, typed. Requires `contracts`.
Valid: `{ id: string }` with suitable standard value types. Warn: reachable
boundary model declares callable method such as `validate(): boolean`.
Behavior-bearing value objects may be intentional. Standard-library internals
are not expanded. This is not a universal ban on classes at boundaries.
