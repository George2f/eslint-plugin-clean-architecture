import fileSystem from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import typescript from 'typescript';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { Architecture, Context, Dependency, Rule } from '../types.js';
import { architectureOf } from './config.js';
import { createRule, report } from './create-rule.js';

const defaultSettings: { options: typescript.CompilerOptions } = {
  options: {
    module: typescript.ModuleKind.ESNext, moduleResolution: typescript.ModuleResolutionKind.Bundler,
    target: typescript.ScriptTarget.ESNext, allowJs: true, resolveJsonModule: true,
  },
};
const compilerCache = new Map<string, { mtimeMs: number; size: number; value: { files?: string[]; options: typescript.CompilerOptions } }>();

export function compilerSettings(config: Architecture): { files?: string[]; options: typescript.CompilerOptions } {
  if (!config.project?.tsconfig) return defaultSettings;
  const file = path.resolve(config.root, config.project.tsconfig);
  const stat = fileSystem.statSync(file);
  const previous = compilerCache.get(file);
  if (previous?.mtimeMs === stat.mtimeMs && previous.size === stat.size) return previous.value;
  const loaded = typescript.readConfigFile(file, typescript.sys.readFile);
  if (loaded.error) throw new Error(typescript.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
  const parsed = typescript.parseJsonConfigFileContent(loaded.config, typescript.sys, path.dirname(file), undefined, file);
  const errors = parsed.errors.filter(error => error.code !== 18003);
  if (errors.length) throw new Error(errors.map(error => typescript.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  const value = { files: parsed.fileNames, options: parsed.options };
  compilerCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value });
  return value;
}

export type LoadKind = 'static' | 'import' | 'require';

export function moduleMode(source: string, options: typescript.CompilerOptions, host: typescript.ModuleResolutionHost, kind: LoadKind): typescript.ResolutionMode {
  if (kind === 'require') return typescript.ModuleKind.CommonJS;
  if (kind === 'import') return typescript.ModuleKind.ESNext;
  if (options.moduleResolution === typescript.ModuleResolutionKind.Node16 || options.moduleResolution === typescript.ModuleResolutionKind.NodeNext) {
    return typescript.getImpliedNodeFormatForFile(source, undefined, host, options);
  }
  return typescript.ModuleKind.ESNext;
}

const resolutionCaches = new WeakMap<typescript.CompilerOptions, Map<string, typescript.ModuleResolutionCache>>();

function resolutionCache(root: string, options: typescript.CompilerOptions): typescript.ModuleResolutionCache {
  let byRoot = resolutionCaches.get(options);
  if (!byRoot) {
    byRoot = new Map();
    resolutionCaches.set(options, byRoot);
  }
  let cache = byRoot.get(root);
  if (!cache) {
    cache = typescript.createModuleResolutionCache(root, value => value, options);
    byRoot.set(root, cache);
  }
  return cache;
}

export function resolveDependency(config: Architecture, source: string, specifier: string, options?: typescript.CompilerOptions, kind: LoadKind = 'static'): string | undefined {
  if (isBuiltin(specifier)) return undefined;
  const settings = options ?? compilerSettings(config).options;
  const cache = config.project?.cache === 'strict' ? undefined : resolutionCache(config.root, settings);
  return typescript.resolveModuleName(specifier, source, settings, typescript.sys, cache, undefined,
    moduleMode(source, settings, typescript.sys, kind)).resolvedModule?.resolvedFileName;
}

export function literal(node: TSESTree.Node | null | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? undefined;
  if (node?.type === 'TSLiteralType') return literal(node.literal);
  return undefined;
}

function unshadowed(context: Context, node: TSESTree.Node, name: string): boolean {
  let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(name);
    if (variable) return variable.defs.length === 0;
    scope = scope.upper;
  }
  return true;
}

export function dependencyVisitors(context: Context, visit: (dependency: Dependency) => void,
  dynamic?: (node: TSESTree.Node) => void): TSESLint.RuleListener {
  const config = architectureOf(context);
  const options = compilerSettings(config).options;
  const includeTypeOnly = context.options[0]?.includeTypeOnly ?? config.includeTypeOnly ?? true;
  const collect = (node: TSESTree.Node, source: TSESTree.Node | null | undefined, typeOnly = false, kind: LoadKind = 'static'): void => {
    const specifier = literal(source);
    if (specifier === undefined) { dynamic?.(node); return; }
    if (typeOnly && !includeTypeOnly) return;
    visit({ specifier, target: resolveDependency(config, context.physicalFilename, specifier, options, kind), node, typeOnly });
  };
  return {
    ImportDeclaration(node) {
      collect(node, node.source, node.importKind === 'type' ||
        (node.specifiers.length > 0 && node.specifiers.every(spec => spec.type === 'ImportSpecifier' && spec.importKind === 'type')));
    },
    ExportNamedDeclaration(node) {
      if (node.source) collect(node, node.source, node.exportKind === 'type' ||
        (node.specifiers.length > 0 && node.specifiers.every(spec => spec.exportKind === 'type')));
    },
    ExportAllDeclaration(node) { collect(node, node.source, node.exportKind === 'type'); },
    ImportExpression(node) { collect(node, node.source, false, 'import'); },
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require' && unshadowed(context, node, 'require')) {
        collect(node, node.arguments[0], false, 'require');
      }
    },
    TSImportEqualsDeclaration(node) {
      if (node.moduleReference.type === 'TSExternalModuleReference') collect(node, node.moduleReference.expression, node.importKind === 'type', 'require');
    },
    TSImportType(node) { collect(node, node.source ?? node.argument, true); },
  };
}

interface DependencyDefinition {
  name: string;
  description: string;
  chapters: number[];
  principle: string;
  scopes?: (keyof Architecture)[];
  limitations?: string;
  check: (config: Architecture, source: string, dependency: Dependency) => string | undefined;
}

export function dependencyRule(definition: DependencyDefinition): Rule {
  return createRule({
    ...definition,
    limitations: definition.limitations ?? 'Requires declared module roles/boundaries. Unknown runtime targets are not inferred. Type-only dependencies included by default.',
    create(context) {
      const config = architectureOf(context);
      return dependencyVisitors(context, dependency => {
        const detail = definition.check(config, context.physicalFilename, dependency);
        if (detail) report(context, dependency.node, detail, definition.chapters);
      });
    },
  });
}
