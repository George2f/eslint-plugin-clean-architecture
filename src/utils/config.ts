import path from 'node:path';
import { minimatch } from 'minimatch';
import type { Architecture, Component, Context, Layer, Role } from '../types.js';
import { defaultArchitecture } from './defaults.js';

export const roles: Role[] = ['entity', 'use-case', 'port', 'adapter', 'controller',
  'repository', 'view', 'presenter', 'composition', 'test'];

export const slash = (value: string): string => value.replaceAll('\\', '/');
export const relative = (config: Architecture, file: string): string =>
  slash(path.relative(config.root, file));

export function matches(file: string, patterns: readonly string[] = []): boolean {
  return patterns.some(pattern => minimatch(slash(file), pattern, { dot: true, nonegate: true }));
}

function strings(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item || item.startsWith('!'))) {
    throw new Error(`clean-architecture: ${name} must be an array of nonempty, non-negated patterns`);
  }
}

function object(value: unknown, name: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`clean-architecture: ${name} must be an object`);
  }
}

export function defineArchitecture(config: Architecture): Architecture {
  if (!config || typeof config !== 'object' || typeof config.root !== 'string' || !path.isAbsolute(config.root)) {
    throw new Error('clean-architecture: architecture.root must be an absolute path');
  }
  const allowed = new Set(['root', 'layers', 'components', 'roles', 'core', 'infrastructure',
    'volatile', 'stable', 'contracts', 'immutable', 'tests', 'testingApi', 'businessTests',
    'ignore', 'project', 'unresolved']);
  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) throw new Error(`clean-architecture: unknown architecture field ${key}`);
  }
  for (const key of ['roles', 'infrastructure', 'project'] as const) {
    if (config[key] !== undefined) object(config[key], key);
  }
  for (const key of ['core', 'volatile', 'stable', 'contracts', 'immutable', 'tests',
    'testingApi', 'businessTests', 'ignore'] as const) {
    if (config[key] !== undefined) strings(config[key], key);
  }
  for (const key of ['layers', 'components'] as const) {
    const values = config[key];
    if (values === undefined) continue;
    if (!Array.isArray(values)) throw new Error(`clean-architecture: ${key} must be an array`);
    const names = new Set<string>();
    for (const item of values) {
      if (!item || typeof item.name !== 'string' || !item.name || names.has(item.name)) {
        throw new Error(`clean-architecture: ${key} require unique nonempty names`);
      }
      names.add(item.name);
      const allowedFields = key === 'layers' ? ['name', 'files', 'allow'] : ['name', 'files', 'public', 'actor', 'useCase'];
      if (Object.keys(item).some(field => !allowedFields.includes(field))) {
        throw new Error(`clean-architecture: unknown field in ${key}.${item.name}`);
      }
      strings(item.files, `${key}.${item.name}.files`);
      if (key === 'layers') strings((item as Layer).allow, `layers.${item.name}.allow`);
      else {
        const component = item as Component;
        strings(component.public, `components.${item.name}.public`);
        for (const field of ['actor', 'useCase'] as const) {
          if (component[field] !== undefined && (typeof component[field] !== 'string' || !component[field])) {
            throw new Error(`clean-architecture: components.${item.name}.${field} must be a nonempty string`);
          }
        }
      }
    }
  }
  for (const layer of config.layers ?? []) {
    for (const name of layer.allow) {
      if (!config.layers?.some(item => item.name === name)) {
        throw new Error(`clean-architecture: layer ${layer.name} allows unknown layer ${name}`);
      }
    }
  }
  for (const [role, patterns] of Object.entries(config.roles ?? {})) {
    if (!roles.includes(role as Role)) throw new Error(`clean-architecture: unknown role ${role}`);
    strings(patterns, `roles.${role}`);
  }
  for (const [kind, patterns] of Object.entries(config.infrastructure ?? {})) {
    if (!['framework', 'persistence', 'transport', 'platform', 'hardware'].includes(kind)) {
      throw new Error(`clean-architecture: unknown infrastructure category ${kind}`);
    }
    strings(patterns, `infrastructure.${kind}`);
  }
  if (config.unresolved !== undefined && !['ignore', 'report'].includes(config.unresolved)) {
    throw new Error('clean-architecture: unresolved must be ignore or report');
  }
  if (config.project) {
    if (Object.keys(config.project).some(key => key !== 'tsconfig' && key !== 'files')) {
      throw new Error('clean-architecture: project accepts only tsconfig and files');
    }
    if (config.project.tsconfig !== undefined && typeof config.project.tsconfig !== 'string') {
      throw new Error('clean-architecture: project.tsconfig must be a path');
    }
    if (config.project.files !== undefined) strings(config.project.files, 'project.files');
    if (!config.project.tsconfig && !config.project.files?.length) {
      throw new Error('clean-architecture: project requires tsconfig or files');
    }
  }
  return config;
}

export function architecture(context: Context): Architecture {
  const settings = context.settings['clean-architecture'];
  return defineArchitecture(settings === undefined ? defaultArchitecture(context.cwd) : settings as Architecture);
}

export function requireScope(config: Architecture, key: keyof Architecture, rule: string): void {
  const value = config[key];
  if (!value || (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
    throw new Error(`clean-architecture/${rule}: configure architecture.${key} before enabling this rule`);
  }
}

function unique<T extends { name: string; files: string[] }>(
  config: Architecture, file: string, values: T[] = [],
): T | undefined {
  const found = values.filter(value => matches(relative(config, file), value.files));
  if (found.length > 1) {
    throw new Error(`clean-architecture: ${relative(config, file)} ambiguously belongs to ${found.map(item => item.name).join(', ')}`);
  }
  return found[0];
}

export const layerOf = (config: Architecture, file: string): Layer | undefined => unique(config, file, config.layers);
export const componentOf = (config: Architecture, file: string): Component | undefined => unique(config, file, config.components);
export const hasRole = (config: Architecture, file: string, role: Role): boolean =>
  matches(relative(config, file), config.roles?.[role]);
export const inCore = (config: Architecture, file: string): boolean =>
  matches(relative(config, file), config.core);
export const isTest = (config: Architecture, file: string): boolean =>
  matches(relative(config, file), config.tests) || hasRole(config, file, 'test');

export function targetMatches(config: Architecture, patterns: string[] = [], specifier: string, target?: string): boolean {
  const packagePath = target ? slash(target).split('/node_modules/').at(-1) : undefined;
  return patterns.some(pattern => matches(specifier, [pattern]) ||
    (!/[?*{}[\]]/.test(pattern) && specifier.startsWith(`${pattern}/`)) ||
    (target !== undefined && matches(relative(config, target), [pattern])) ||
    (packagePath !== undefined && target !== undefined && slash(target).includes('/node_modules/') &&
      (matches(packagePath, [pattern]) || packagePath.startsWith(`${pattern}/`))));
}

export function isVolatile(config: Architecture, specifier: string, target?: string): boolean {
  return targetMatches(config, config.volatile, specifier, target) &&
    !targetMatches(config, config.stable, specifier, target);
}
