# Book coverage and detector decisions

Reference: Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software
Structure and Design* (2017). Chapter 34 is Simon Brown's contribution. Section
names below identify the source; descriptions are paraphrases, not book text.
The ebook itself is not distributed with this package.

The plugin implements 31 detectors: 21 configured policies, 7 heuristics, and
3 advisory metrics. A configured policy is deterministic relative to supplied
classification; it does not prove an entire architectural principle. Several
chapters share a detector. No chapter is counted as fully enforced just because
it has a matching rule.

Frontend profiles add frontend folder conventions without changing the book
mapping. JavaScript executes all AST detectors; five formerly typed detectors now
also have literal-import/local-class AST paths. Contract and interface-shape
detectors remain TypeScript-only.

| Chapter / section | Detectable application | Status and limits |
| --- | --- | --- |
| 1. What Is Design and Architecture? / The Goal | Boundary protection supports future change | Context only: maintenance cost needs historical/business evidence |
| 2. A Tale of Two Values / Architecture | Enforce declared structure alongside behavior | Context only: priorities and business value cannot be inferred |
| 3. Paradigm Overview | Dependency inversion and immutable scopes | Covered through Ch. 5/6 detectors; no mandatory paradigm |
| 4. Structured Programming / Functional Decomposition, Tests | Existing language/lint checks and behavioral tests | No additional detector: JS has structured flow; architecture plugin cannot prove correctness |
| 5. Object-Oriented Programming / Polymorphism | `prefer-polymorphic-dispatch`, dependency direction and DIP checks | Partial: repeated subtype checks are a syntax-level heuristic |
| 6. Functional Programming / Segregation of Mutability | `no-mutation-in-immutable-modules`, `no-mutable-module-state` | Configured scopes; not a proof of purity, alias freedom, or concurrency safety |
| 7. SRP / Actors, Solutions | `no-mixed-actor-dependencies` | Heuristic: actors explicitly declared; orchestration may legitimately depend on several |
| 8. OCP / Directional Control, Information Hiding | `dependency-direction`, `component-public-api`, `prefer-polymorphic-dispatch` | Partial: protects chosen extension boundaries, cannot predict future changes |
| 9. LSP / LSP and Architecture | `no-subtype-rejection`, `prefer-polymorphic-dispatch` | Heuristic: throw-only implementations and repeated subtype inspection; no inferred behavioral contracts |
| 10. ISP / ISP and Language, ISP and Architecture | `prefer-segregated-interfaces` | Heuristic: nonescaping interface parameter member usage; TS does not have Java's recompilation semantics |
| 11. DIP / Stable Abstractions, Factories | `no-volatile-concrete-dependency`, `no-volatile-construction`, `no-volatile-inheritance`, `no-concrete-method-override`, `port-ownership` | Explicit volatility and stable exceptions; concrete override guidance is opt-in heuristic |
| 12. Components | `component-public-api`, configured component graph | Components are declared deployment/ownership units, not guessed from folders |
| 13. Component Cohesion / REP | `component-public-api` protects declared released entry points | Partial: no claim to verify release/version coherence from source alone |
| 13. Component Cohesion / CCP | `no-mixed-actor-dependencies`, component configuration | Partial heuristic; actual co-change needs history and reasons for changes |
| 13. Component Cohesion / CRP | `prefer-segregated-interfaces`, `component-public-api` | Partial: unused requirements are a signal; no blanket claim that barrel imports force runtime baggage |
| 14. Component Coupling / ADP | `no-component-cycles` | Concrete cycle evidence over resolvable declared components |
| 14. Component Coupling / SDP | `stable-dependencies` | Advisory module-based adaptation of class-oriented instability |
| 14. Component Coupling / SAP, Main Sequence | `stable-abstractions`, `main-sequence-distance` | Advisory module-based abstraction metric, documented separately |
| 15. What Is Architecture? / Keeping Options Open | `no-core-infrastructure`, dependency direction | Partial: preserves declared replacement boundaries; cannot identify optimal commitment timing |
| 16. Independence / Decoupling Layers, Decoupling Use Cases | `dependency-direction`, `use-case-isolation` | Declared private use-case internals protected; public collaboration allowed |
| 16. Independence / Duplication | No automatic deduplication | Excluded: textual similarity cannot establish whether change reasons coincide |
| 17. Boundaries: Drawing Lines / Plugin Architecture | Direction, infrastructure isolation, public APIs | Configured boundaries; no claim to select correct boundaries automatically |
| 18. Boundary Anatomy / Boundary Crossing | Dependency collection, `no-dynamic-boundary-dependencies`, `no-unresolved-boundary-dependencies` | Optional completeness policies expose unverifiable targets; runtime wiring remains unknown |
| 19. Policy and Level / Level | `dependency-direction` | Policy levels supplied, not inferred from call direction |
| 20. Business Rules / Entities, Use Cases | Core infrastructure isolation, dependency direction | Protects entity/use-case source dependencies, not correctness of business policy |
| 20. Business Rules / Request and Response Models | `no-outer-types-in-contracts`, `boundary-model-dependencies`, `no-entity-boundary-data`, `no-behavior-in-boundary-models` | Exported type traversal; callable transfer data is an opt-in heuristic |
| 21. Screaming Architecture / Frameworks Are Tools, Testable Architectures | Core infrastructure isolation, testing boundaries | Partial: folder names cannot prove that architecture communicates business intent |
| 22. The Clean Architecture / Dependency Rule | Direction, port ownership, contract checks | Direct and reachable public-type violations checked; arbitrary runtime values not inferred |
| 22. The Clean Architecture / Crossing Boundaries, Boundary Data | Typed contract/port checks | No mandatory four-circle architecture; designated contracts only |
| 23. Presenters and Humble Objects / Presenters and Views | `humble-view-dependencies`, `no-view-data-formatting` | Dependency check plus narrow method-name heuristic; normal rendering not prohibited |
| 23. Presenters and Humble Objects / Database Gateways, Data Mappers | Infrastructure isolation and boundary model checks | Protects declared gateways; does not generate repositories or infer business logic |
| 24. Partial Boundaries | Public APIs/layer relationships may express partial boundaries | No rule requiring every boundary to be full: book explicitly discusses alternatives |
| 25. Layers and Boundaries | Independent layer, component, and role checks | Multiple axes supported; no ability to discover every missing boundary |
| 26. The Main Component / The Ultimate Detail | `no-composition-root-dependency`, `no-volatile-construction` | Wiring allowed outside protected core; does not require a DI container |
| 27. Services: Great and Small | Source boundaries and declared deployment components | Partial: processes do not establish service independence; external service code and network contracts unseen |
| 28. The Test Boundary / Testing API, Structural Coupling | `no-production-test-dependency`, `testing-api-boundaries` | Only designated business tests restricted; UI/end-to-end tests are not globally banned |
| 29. Clean Embedded Architecture / HAL, OSAL | Configured hardware/platform categories in `no-core-infrastructure` | JS/TS host-side boundary check; cannot inspect firmware, memory maps, timing, or actual hardware calibration |
| 30. The Database Is a Detail | Persistence isolation, boundary model checks | Database rows/types restricted when classified; no SQL-text guessing |
| 31. The Web Is a Detail | Transport isolation, boundary model checks | Transport framework/types classified; web presentation remains permitted outside core |
| 32. Frameworks Are Details / The Solution | Infrastructure isolation, volatile inheritance, composition separation | Main may integrate frameworks; no universal decorator ban |
| 33. Case Study: Video Sales / Dependency Management | Rules validated with entities, ports, adapters, controllers, and Main fixtures | Application of earlier principles, not a new independent rule |
| 34. The Missing Chapter / Encapsulation, Implementation Details | `component-public-api`, `no-controller-repository-access` | Actual resolved access enforced; no required package-by-layer or package-by-feature layout |
| Appendix A. Architecture Archaeology | Historical examples inform boundaries | No additional universal statically checkable prescription |

## Research decisions

| Candidate | Decision / evidence |
| --- | --- |
| Infer SRP from class/function length | Rejected: Ch. 7 defines responsibility by actor; length does not establish actor ownership |
| Infer CCP from file similarity | Rejected: reasons and timing of change are not available in a source snapshot |
| Mine Git history to enforce CCP | Outside ESLint scope: expensive historical analysis and actor attribution would still be needed |
| Treat every switch as an OCP violation | Rejected: switches can implement valid closed sets; admitted heuristic requires repeated proper subtype inspection |
| Prove LSP with TypeScript assignability | Rejected: assignability does not establish behavioral preconditions/postconditions; throw-only heuristic is explicitly weaker |
| Warn on every partly used interface | Narrowed: only nonescaping, statically accessed identifier parameters of project-owned interfaces with methods admitted; data-only, external, forwarded, and dynamic consumers skipped |
| Ban construction of all concrete objects | Rejected: Ch. 11 explicitly permits stable concrete background facilities; only configured volatile targets prohibited |
| Ban all inherited concrete overrides | Narrowed to opt-in heuristic; framework hooks and intended template methods are valid counterexamples |
| Detect CRP from heavy barrel imports | Not shipped: TS erasure, bundler tree shaking, and side effects affect actual forced dependency; public-boundary and interface checks provide narrower evidence |
| Validate REP from missing package version | Not shipped: components can have external release mechanisms; version metadata alone does not establish cohesive reuse/release units |
| Expose internal types through a public barrel | No blanket ban: exporting an internal declaration through an intended entry point can be the public API, not a leak |
| Require DTO classes / no classes at boundaries | Rejected: structs, objects, arguments, and suitable value types can all be valid; only configured entity/outer types or heuristic behavior checked |
| Detect any business logic in views | Not claimed: admitted formatting-method heuristic is deliberately narrower |
| Pure-function verification | Not claimed: arbitrary aliases, callees, getters, and native code prevent proof; explicit mutations checked |

## Future rules

Add a detector only with a chapter/section reference, observable condition,
counterexamples, valid/invalid tests, requirements, and documented limits.
No admitted candidate remains unimplemented in this release. Excluded research
items above are deliberate limitations, not promises disguised as coverage.
