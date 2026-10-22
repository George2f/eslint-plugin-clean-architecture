import type { ESLint, Rule as ESLintRule } from 'eslint';
import packageJson from '../package.json';
import type { Architecture, Docs, FlatConfig, Rule } from './types.js';
import { defineArchitecture } from './utils/config.js';
import { defaultArchitecture, frontendArchitecture, hasBackendLayout, hasFrontendLayout } from './utils/defaults.js';
import dependencyDirection from './rules/dependency-direction.js';
import componentPublicApi from './rules/component-public-api.js';
import noCoreInfrastructure from './rules/no-core-infrastructure.js';
import noCompositionRootDependency from './rules/no-composition-root-dependency.js';
import noProductionTestDependency from './rules/no-production-test-dependency.js';
import useCaseIsolation from './rules/use-case-isolation.js';
import noControllerRepositoryAccess from './rules/no-controller-repository-access.js';
import humbleViewDependencies from './rules/humble-view-dependencies.js';
import testingApiBoundaries from './rules/testing-api-boundaries.js';
import noVolatileConcreteDependency from './rules/no-volatile-concrete-dependency.js';
import noDynamicBoundaryDependencies from './rules/no-dynamic-boundary-dependencies.js';
import noUnresolvedBoundaryDependencies from './rules/no-unresolved-boundary-dependencies.js';
import noComponentCycles from './rules/no-component-cycles.js';
import stableDependencies from './rules/stable-dependencies.js';
import stableAbstractions from './rules/stable-abstractions.js';
import mainSequenceDistance from './rules/main-sequence-distance.js';
import noVolatileConstruction from './rules/no-volatile-construction.js';
import noVolatileInheritance from './rules/no-volatile-inheritance.js';
import noConcreteMethodOverride from './rules/no-concrete-method-override.js';
import portOwnership from './rules/port-ownership.js';
import noOuterTypesInContracts from './rules/no-outer-types-in-contracts.js';
import noEntityBoundaryData from './rules/no-entity-boundary-data.js';
import boundaryModelDependencies from './rules/boundary-model-dependencies.js';
import noMutationInImmutableModules from './rules/no-mutation-in-immutable-modules.js';
import noMutableModuleState from './rules/no-mutable-module-state.js';
import noMixedActorDependencies from './rules/no-mixed-actor-dependencies.js';
import noViewDataFormatting from './rules/no-view-data-formatting.js';
import preferSegregatedInterfaces from './rules/prefer-segregated-interfaces.js';
import noSubtypeRejection from './rules/no-subtype-rejection.js';
import preferPolymorphicDispatch from './rules/prefer-polymorphic-dispatch.js';
import noBehaviorInBoundaryModels from './rules/no-behavior-in-boundary-models.js';

const registry: Record<string, Rule> = {
  'dependency-direction': dependencyDirection,
  'component-public-api': componentPublicApi,
  'no-core-infrastructure': noCoreInfrastructure,
  'no-composition-root-dependency': noCompositionRootDependency,
  'no-production-test-dependency': noProductionTestDependency,
  'use-case-isolation': useCaseIsolation,
  'no-controller-repository-access': noControllerRepositoryAccess,
  'humble-view-dependencies': humbleViewDependencies,
  'testing-api-boundaries': testingApiBoundaries,
  'no-volatile-concrete-dependency': noVolatileConcreteDependency,
  'no-dynamic-boundary-dependencies': noDynamicBoundaryDependencies,
  'no-unresolved-boundary-dependencies': noUnresolvedBoundaryDependencies,
  'no-component-cycles': noComponentCycles,
  'stable-dependencies': stableDependencies,
  'stable-abstractions': stableAbstractions,
  'main-sequence-distance': mainSequenceDistance,
  'no-volatile-construction': noVolatileConstruction,
  'no-volatile-inheritance': noVolatileInheritance,
  'no-concrete-method-override': noConcreteMethodOverride,
  'port-ownership': portOwnership,
  'no-outer-types-in-contracts': noOuterTypesInContracts,
  'no-entity-boundary-data': noEntityBoundaryData,
  'boundary-model-dependencies': boundaryModelDependencies,
  'no-mutation-in-immutable-modules': noMutationInImmutableModules,
  'no-mutable-module-state': noMutableModuleState,
  'no-mixed-actor-dependencies': noMixedActorDependencies,
  'no-view-data-formatting': noViewDataFormatting,
  'prefer-segregated-interfaces': preferSegregatedInterfaces,
  'no-subtype-rejection': noSubtypeRejection,
  'prefer-polymorphic-dispatch': preferPolymorphicDispatch,
  'no-behavior-in-boundary-models': noBehaviorInBoundaryModels,
};

type PublicRule = ESLintRule.RuleModule & { meta: ESLintRule.RuleMetaData & { docs: Docs } };
export const rules = registry as unknown as Record<string, PublicRule>;

const plugin = {
  meta: { name: packageJson.name, version: packageJson.version },
  rules: rules as unknown as ESLint.Plugin['rules'],
  configs: {} as Record<string, FlatConfig>,
} satisfies ESLint.Plugin;

export interface ConfigOptions {
  level?: 'recommended' | 'strict' | 'strictest';
  types?: boolean;
  project?: boolean;
  completeness?: boolean;
}

export interface FrontendConfigOptions {
  strict?: boolean;
  types?: boolean;
  coverage?: 'warn' | 'off';
  severity?: 'error' | 'warn';
  heuristics?: 'off' | 'warn' | 'error';
}

const frontendBaseRules: Record<string, 'error' | 'warn'> = {
  'clean-architecture/dependency-direction': 'error',
  'clean-architecture/no-production-test-dependency': 'error',
  'clean-architecture/no-core-infrastructure': 'error',
  'clean-architecture/no-composition-root-dependency': 'error',
  'clean-architecture/no-volatile-concrete-dependency': 'error',
  'clean-architecture/no-volatile-construction': 'error',
  'clean-architecture/no-volatile-inheritance': 'error',
};

const frontendStrictRules: Record<string, 'error' | 'warn'> = {
  'clean-architecture/no-view-data-formatting': 'warn',
  'clean-architecture/no-subtype-rejection': 'warn',
  'clean-architecture/prefer-polymorphic-dispatch': 'warn',
};

const frontendTypedRules: Record<string, 'error' | 'warn'> = {
  'clean-architecture/no-concrete-method-override': 'warn',
  'clean-architecture/prefer-segregated-interfaces': 'warn',
};

const warnedFrontendRoots = new Set<string>();

function warnFrontendCoverage(root: string, coverage: 'warn' | 'off'): void {
  if (coverage === 'warn' && !hasFrontendLayout(root) && !warnedFrontendRoots.has(root)) {
    warnedFrontendRoots.add(root);
    console.warn('clean-architecture: no conventional frontend folders matched; frontend architecture rules are inactive. Configure frontend conventions with createFrontendConfig overrides.');
  }
}

function frontendRules(options: FrontendConfigOptions): Record<string, 'error' | 'warn'> {
  const strict = options.strict ?? false;
  const types = options.types ?? false;
  const severity = options.severity ?? 'error';
  const heuristics = options.heuristics ?? (strict || types ? 'warn' : 'off');
  const rules: Record<string, 'error' | 'warn'> = {};
  for (const name of Object.keys(frontendBaseRules)) rules[name] = severity;
  if (heuristics !== 'off') {
    if (strict) for (const name of Object.keys(frontendStrictRules)) rules[name] = heuristics;
    if (types) for (const name of Object.keys(frontendTypedRules)) rules[name] = heuristics;
  }
  return rules;
}

export function createFrontendConfig(root: string, options: FrontendConfigOptions = {}): FlatConfig {
  if (!options || typeof options !== 'object' ||
    Object.keys(options).some(key => !['strict', 'types', 'coverage', 'severity', 'heuristics'].includes(key)) ||
    ['strict', 'types'].some(key => key in options && typeof options[key as keyof FrontendConfigOptions] !== 'boolean') ||
    (options.coverage !== undefined && !['warn', 'off'].includes(options.coverage)) ||
    (options.severity !== undefined && !['error', 'warn'].includes(options.severity)) ||
    (options.heuristics !== undefined && !['off', 'warn', 'error'].includes(options.heuristics))) {
    throw new Error('clean-architecture: invalid createFrontendConfig options');
  }
  const architecture = defineArchitecture(frontendArchitecture(root, { strict: options.strict }));
  warnFrontendCoverage(root, options.coverage ?? 'warn');
  const strict = options.strict ?? false;
  const types = options.types ?? false;
  return {
    name: `clean-architecture/frontend${strict ? '-strict' : ''}${types ? '-type-checked' : ''}`,
    plugins: { 'clean-architecture': plugin },
    settings: { 'clean-architecture': architecture },
    rules: frontendRules(options),
  };
}

function frontendPreset(name: string, options: FrontendConfigOptions): FlatConfig {
  warnFrontendCoverage(process.cwd(), options.coverage ?? 'warn');
  return {
    name: `clean-architecture/${name}`,
    plugins: { 'clean-architecture': plugin },
    settings: { 'clean-architecture-profile': { strict: options.strict === true } },
    rules: frontendRules(options),
  };
}

export interface LegacyConfig {
  plugins: string[];
  parserOptions: { ecmaVersion: 'latest'; sourceType: 'module' };
  settings?: Record<string, unknown>;
  rules: Record<string, 'error' | 'warn'>;
}

export function createLegacyConfig(config: FlatConfig): LegacyConfig {
  const rules: Record<string, 'error' | 'warn'> = {};
  for (const [name, severity] of Object.entries(config.rules)) {
    rules[name.replace(/^clean-architecture\//, '@george2f/clean-architecture/')] = severity;
  }
  return {
    plugins: ['@george2f/clean-architecture'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    ...(config.settings ? { settings: config.settings } : {}),
    rules,
  };
}

export function createLegacyFrontendConfig(root: string, options: FrontendConfigOptions = {}): LegacyConfig {
  return createLegacyConfig(createFrontendConfig(root, options));
}

function severity(rule: Rule, level: ConfigOptions['level']): 'error' | 'warn' {
  return rule.meta.docs.reliability === 'configured' || level === 'strictest' ? 'error' : 'warn';
}

export function createConfig(architecture: Architecture, options: ConfigOptions = {}): FlatConfig {
  defineArchitecture(architecture);
  if (Object.keys(options).some(key => !['level', 'types', 'project', 'completeness'].includes(key)) ||
    (options.level !== undefined && !['recommended', 'strict', 'strictest'].includes(options.level)) ||
    ['types', 'project', 'completeness'].some(key => key in options && typeof options[key as keyof ConfigOptions] !== 'boolean')) {
    throw new Error('clean-architecture: invalid createConfig options');
  }
  if (options.project && !architecture.project) throw new Error('clean-architecture: project checks require architecture.project');
  const level = options.level ?? 'recommended';
  const enabled: Record<string, 'error' | 'warn'> = {};
  for (const [name, rule] of Object.entries(registry)) {
    const docs = rule.meta.docs;
    if (docs.analysis === 'types' && !options.types) continue;
    if (docs.analysis === 'project' && !options.project) continue;
    if (docs.reliability !== 'configured' && level === 'recommended') continue;
    if (name === 'no-dynamic-boundary-dependencies' && !options.completeness) continue;
    if (name === 'no-unresolved-boundary-dependencies' && !options.completeness && architecture.unresolved !== 'report') continue;
    if (docs.scopes.some(scope => {
      const value = architecture[scope];
      return !value || (typeof value === 'object' && Object.keys(value).length === 0);
    })) continue;
    enabled[`clean-architecture/${name}`] = severity(rule, level);
  }
  return {
    name: `clean-architecture/${level}${options.types ? '/typed' : ''}${options.project ? '/project' : ''}`,
    plugins: { 'clean-architecture': plugin },
    settings: { 'clean-architecture': architecture },
    rules: enabled,
  };
}

const warnedBackendRoots = new Set<string>();

function warnBackendCoverage(root: string): void {
  if (!hasBackendLayout(root) && !warnedBackendRoots.has(root)) {
    warnedBackendRoots.add(root);
    console.warn('clean-architecture: no conventional backend folders matched; backend layer/role rules are inactive. Use explicit architecture settings or a frontend preset.');
  }
}

for (const level of ['recommended', 'strict', 'strictest'] as const) {
  for (const typed of [false, true]) {
    const name = `${level}${typed ? '-type-checked' : ''}`;
    Object.defineProperty(plugin.configs, name, {
      enumerable: true,
      get: () => {
        warnBackendCoverage(process.cwd());
        const config = createConfig(defaultArchitecture(process.cwd()), {
          level, types: typed, project: typed, completeness: typed,
        });
        config.name = `clean-architecture/${name}`;
        // Resolve conventions against ESLint's cwd, not where this module was imported.
        delete config.settings;
        return config;
      },
    });
  }
}

const frontendPresets: [string, FrontendConfigOptions][] = [
  ['frontend', { strict: false, heuristics: 'off' }],
  ['frontend-type-checked', { strict: false, types: true, heuristics: 'warn' }],
  ['frontend-strict', { strict: true, heuristics: 'warn' }],
  ['frontend-strict-type-checked', { strict: true, types: true, heuristics: 'warn' }],
  ['frontend-strictest', { strict: true, heuristics: 'error' }],
  ['frontend-strictest-type-checked', { strict: true, types: true, heuristics: 'error' }],
  ['frontend-adoption', { strict: false, heuristics: 'off', severity: 'warn' }],
];
for (const [name, options] of frontendPresets) {
  Object.defineProperty(plugin.configs, name, {
    enumerable: true,
    get: () => frontendPreset(name, options),
  });
}

export { defineArchitecture };
export type { Architecture, Layer, Component, Role, RuleOptions, Docs, FlatConfig } from './types.js';
export default plugin;
