import type { ESLint, Rule as ESLintRule } from 'eslint';
import packageJson from '../package.json';
import type { Architecture, Docs, FlatConfig, Rule } from './types.js';
import { defineArchitecture } from './utils/config.js';
import { defaultArchitecture } from './utils/defaults.js';
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

for (const level of ['recommended', 'strict', 'strictest'] as const) {
  for (const typed of [false, true]) {
    const name = `${level}${typed ? '-type-checked' : ''}`;
    const config = createConfig(defaultArchitecture(process.cwd()), {
      level, types: typed, project: typed, completeness: typed,
    });
    config.name = `clean-architecture/${name}`;
    // Resolve conventions against ESLint's cwd, not where this module was imported.
    delete config.settings;
    plugin.configs[name] = config;
  }
}

export { defineArchitecture };
export type { Architecture, Layer, Component, Role, RuleOptions, Docs, FlatConfig } from './types.js';
export default plugin;
