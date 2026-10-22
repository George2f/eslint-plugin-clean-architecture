import path from 'node:path';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { Architecture, Context, Dependency, Rule } from '../types.js';
import { architecture } from './config.js';
import { createRule, report } from './create-rule.js';

export function compilerSettings(config: Architecture): { files?: string[]; options: ts.CompilerOptions } {
  const defaults: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext, allowJs: true, resolveJsonModule: true,
  };
  if (!config.project?.tsconfig) return { options: defaults };
  const file = path.resolve(config.root, config.project.tsconfig);
  const loaded = ts.readConfigFile(file, ts.sys.readFile);
  if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, path.dirname(file), undefined, file);
  const errors = parsed.errors.filter(error => error.code !== 18003);
  if (errors.length) throw new Error(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  return { files: parsed.fileNames, options: parsed.options };
}

export type LoadKind = 'static' | 'import' | 'require';

export function moduleMode(source: string, options: ts.CompilerOptions, host: ts.ModuleResolutionHost, kind: LoadKind): ts.ResolutionMode {
  if (kind === 'require') return ts.ModuleKind.CommonJS;
  if (kind === 'import') return ts.ModuleKind.ESNext;
  if (options.moduleResolution === ts.ModuleResolutionKind.Node16 || options.moduleResolution === ts.ModuleResolutionKind.NodeNext) {
    return ts.getImpliedNodeFormatForFile(source, undefined, host, options);
  }
  return ts.ModuleKind.ESNext;
}

export function resolveDependency(config: Architecture, source: string, specifier: string, options?: ts.CompilerOptions, kind: LoadKind = 'static'): string | undefined {
  if (isBuiltin(specifier)) return undefined;
  const settings = options ?? compilerSettings(config).options;
  return ts.resolveModuleName(specifier, source, settings, ts.sys, undefined, undefined, moduleMode(source, settings, ts.sys, kind))
    .resolvedModule?.resolvedFileName;
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
  const config = architecture(context);
  const options = compilerSettings(config).options;
  const collect = (node: TSESTree.Node, source: TSESTree.Node | null | undefined, typeOnly = false, kind: LoadKind = 'static'): void => {
    const specifier = literal(source);
    if (specifier === undefined) { dynamic?.(node); return; }
    if (typeOnly && context.options[0]?.includeTypeOnly === false) return;
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
      const config = architecture(context);
      return dependencyVisitors(context, dependency => {
        const detail = definition.check(config, context.physicalFilename, dependency);
        if (detail) report(context, dependency.node, detail, definition.chapters);
      });
    },
  });
}
