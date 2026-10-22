import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESLint, Linter } from 'eslint';
import * as parser from '@typescript-eslint/parser';
import plugin, { createConfig, defineArchitecture, rules } from '../src/index.js';
import type { Architecture, Context } from '../src/types.js';
import { architecture, file, root } from './architecture.js';
import { matches, targetMatches } from '../src/utils/config.js';
import { project, lintProject } from './project-cases.js';
import { projectGraph } from '../src/utils/project.js';

function verify(name: string, code: string, config: Architecture = architecture) {
  return new Linter({ cwd: config.root }).verify(code, [{
    files: ['**/*.ts'], languageOptions: { parser }, plugins: { 'clean-architecture': plugin },
    settings: { 'clean-architecture': config }, rules: { [`clean-architecture/${name}`]: 'error' },
  }], { filename: file('application/source.ts') });
}

describe('catalog and presets', () => {
  it('gives every rule metadata, a colocated suite, schema, and no unsafe autofix', () => {
    expect(Object.keys(rules)).toHaveLength(31);
    for (const [name, rule] of Object.entries(rules)) {
      expect(rule.meta.docs.chapters.length).toBeGreaterThan(0);
      expect(rule.meta.docs.limitations).not.toBe('');
      expect(rule.meta.fixable).toBeUndefined();
      expect(fs.existsSync(new URL(`../src/rules/${name}.test.ts`, import.meta.url))).toBe(true);
    }
  });
  it('keeps heuristic and project checks out of recommended', () => {
    const config = createConfig(architecture);
    for (const name of Object.keys(config.rules ?? {})) {
      expect(rules[name.replace('clean-architecture/', '')]?.meta.docs.reliability).toBe('configured');
      expect(rules[name.replace('clean-architecture/', '')]?.meta.docs.analysis).toBe('ast');
    }
  });
  it('includes all admitted checks when requested, using explicit severities', () => {
    const config = createConfig(architecture, { level: 'strictest', types: true, project: true, completeness: true });
    expect(Object.keys(config.rules ?? {})).toHaveLength(Object.keys(rules).length);
    expect(Object.values(config.rules ?? {}).every(value => value === 'error')).toBe(true);
    expect(createConfig(architecture, { level: 'strict', types: true }).rules?.['clean-architecture/no-subtype-rejection']).toBe('warn');
  });
  it('only selects scopes actually declared by createConfig', () => {
    expect(createConfig({ root }).rules).toEqual({});
    expect(() => createConfig({ root }, { project: true })).toThrow('architecture.project');
  });
  it('does not mutate the architecture or nested definitions', () => {
    const config = structuredClone(architecture), before = JSON.stringify(config);
    createConfig(config, { level: 'strictest', types: true, project: true });
    expect(JSON.stringify(config)).toBe(before);
  });
  it('provides useful zero-config presets and separates typed prerequisites', () => {
    for (const [name, count] of [['recommended', 11], ['strict', 13], ['strictest', 13],
      ['recommended-type-checked', 18], ['strict-type-checked', 28], ['strictest-type-checked', 28]] as const) {
      const preset = plugin.configs[name] as Linter.Config;
      expect(Object.keys(preset.rules ?? {})).toHaveLength(count);
      expect(preset.settings).toBeUndefined();
      for (const [qualified, value] of Object.entries(preset.rules ?? {})) {
        const docs = rules[qualified.replace('clean-architecture/', '')]?.meta.docs;
        if (!name.endsWith('type-checked')) expect(docs?.analysis).toBe('ast');
        if (name.startsWith('recommended')) expect(docs?.reliability).toBe('configured');
        if (name.startsWith('strictest')) expect(value).toBe('error');
      }
    }
  });
});

describe('configuration failures', () => {
  it('rejects malformed boundaries and misspelled options', () => {
    expect(() => defineArchitecture({ root: 'relative' })).toThrow('absolute');
    expect(() => defineArchitecture({ root, layers: [{ name: 'core', files: ['**'], allow: ['missing'] }] })).toThrow('unknown layer');
    expect(() => defineArchitecture({ root, core: ['!src/**'] })).toThrow('non-negated');
    const duplicate = { name: 'same', files: ['src/**'], public: [] };
    expect(() => defineArchitecture({ root, components: [duplicate, duplicate] })).toThrow('unique');
    expect(() => createConfig(architecture, { level: 'typo' as 'strict' })).toThrow('invalid createConfig');
    expect(() => defineArchitecture({ root, roles: true as unknown as Architecture['roles'] })).toThrow('roles must be an object');
    expect(() => verify('dependency-direction', '', { root })).toThrow('architecture.layers');
    expect(() => verify('no-concrete-method-override', 'export class Example {}')).toThrow('requires @typescript-eslint/parser');
  });
  it('rejects ambiguous classification instead of choosing arbitrary precedence', () => {
    expect(() => verify('dependency-direction', 'import "../domain/entity.js";', {
      ...architecture, layers: [...(architecture.layers ?? []), { name: 'overlap', files: ['src/application/**'], allow: [] }],
    })).toThrow('ambiguously belongs');
  });
  it('works without architecture settings when a preset is used', () => {
    expect(new Linter({ cwd: root }).verify('export {};', [{
      files: ['**/*.ts'], ...(plugin.configs.recommended as Linter.Config),
    }], { filename: 'source.ts' })).toEqual([]);
  });
  it('enforces conventional boundaries using ESLint cwd rather than module import cwd', () => {
    const config = { files: ['**/*.js'], ...(plugin.configs.recommended as Linter.Config) };
    const linter = new Linter({ cwd: root });
    const allowed = linter.verify('import { Order } from "../domain/index.js";', [config], { filename: file('application/source.js') });
    const forbidden = linter.verify('import { Volatile } from "../adapters/volatile.js";', [config], { filename: file('domain/source.js') });
    expect(allowed).toEqual([]);
    expect(forbidden.some(message => message.ruleId === 'clean-architecture/dependency-direction')).toBe(true);
  });
  it('requires parser services only for the typed presets', () => {
    expect(() => new Linter({ cwd: root }).verify('export {};', [{
      files: ['**/*.ts'], ...(plugin.configs['strict-type-checked'] as Linter.Config),
    }], { filename: file('application/source.ts') })).toThrow('requires @typescript-eslint/parser');
  });
});

describe('resolution and dependency forms', () => {
  it('recognizes Windows separators and scoped package subpaths', () => {
    expect(matches('src\\domain\\entity.ts', ['src/domain/**'])).toBe(true);
    expect(targetMatches(architecture, ['@vendor/db'], '@vendor/db/client')).toBe(true);
    expect(targetMatches(architecture, ['@vendor/db'], '@vendor/db-extra')).toBe(false);
  });
  it('respects type-only exclusion and shadowed require', () => {
    const linter = new Linter({ cwd: root });
    const config: Linter.Config = {
      files: ['**/*.ts'], languageOptions: { parser }, plugins: { 'clean-architecture': plugin },
      settings: { 'clean-architecture': architecture },
      rules: { 'clean-architecture/dependency-direction': ['error', { includeTypeOnly: false }] },
    };
    expect(linter.verify('import { type Volatile } from "@adapters/volatile";', [config], { filename: file('application/source.ts') })).toEqual([]);
    expect(linter.verify('function f(require) { require("@adapters/volatile"); }', [config], { filename: file('application/source.ts') })).toEqual([]);
  });
  it('resolves workspace package exports and invalidates when exports change', () => {
    const config = project({
      'a/index.ts': 'import "workspace-b";', 'b/index.ts': 'import "../a/index.js";', 'b/safe.ts': 'export {};',
      'b/package.json': '{"name":"workspace-b","exports":"./index.ts"}',
    });
    config.components = [
      { name: 'a', files: ['a/**'], public: ['a/index.ts'] },
      { name: 'b', files: ['b/index.ts'], public: ['b/index.ts'] },
      { name: 'c', files: ['b/safe.ts'], public: ['b/safe.ts'] },
    ];
    fs.mkdirSync(`${config.root}/node_modules`);
    fs.symlinkSync(`${config.root}/b`, `${config.root}/node_modules/workspace-b`, 'junction');
    const manifest = `${config.root}/b/package.json`;
    expect(lintProject(config, 'a/index.ts', 'no-component-cycles')).toHaveLength(1);
    fs.writeFileSync(manifest, '{"name":"workspace-b","exports":"./safe.ts"}');
    expect(lintProject(config, 'a/index.ts', 'no-component-cycles')).toEqual([]);
  });
});

describe('actual ESLint integration', () => {
  it('runs AST checks on JavaScript with the default Espree parser', () => {
    const linter = new Linter({ cwd: root });
    const config = { files: ['**/*.js'], ...createConfig(architecture) };
    const allowed = linter.verify('import { Order } from "../domain/index.js";', [config], { filename: file('application/source.js') });
    const forbidden = linter.verify('import { Volatile } from "../adapters/volatile.js";', [config], { filename: file('application/source.js') });
    expect(allowed).toEqual([]);
    expect(forbidden.some(message => message.ruleId === 'clean-architecture/dependency-direction')).toBe(true);
  });
  it('runs typed rules through ESLint on inferred exported contracts', async () => {
    const eslint = new ESLint({
      cwd: root, overrideConfigFile: true, cache: false,
      overrideConfig: [{
        files: ['**/*.ts'], languageOptions: { parser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
        plugins: { 'clean-architecture': plugin }, settings: { 'clean-architecture': architecture },
        rules: { 'clean-architecture/no-outer-types-in-contracts': 'error' },
      }],
    });
    const [result] = await eslint.lintFiles([file('application/contracts-inferred.ts')]);
    expect(result?.fatalErrorCount).toBe(0);
    expect(result?.messages).toEqual([expect.objectContaining({ ruleId: 'clean-architecture/no-outer-types-in-contracts' })]);
  });
  it('runs the typed preset without requiring architecture settings', async () => {
    const eslint = new ESLint({
      cwd: root, overrideConfigFile: true, cache: false,
      overrideConfig: [{
        ...(plugin.configs['strict-type-checked'] as Linter.Config),
        files: ['**/*.ts'], languageOptions: { parser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
      }],
    });
    const [result] = await eslint.lintFiles([file('application/override-bad.ts')]);
    expect(result?.fatalErrorCount).toBe(0);
    expect(result?.messages).toContainEqual(expect.objectContaining({ ruleId: 'clean-architecture/no-concrete-method-override', severity: 1 }));
  });
  it('fails explicitly when contract traversal budget is exhausted', async () => {
    const eslint = new ESLint({
      cwd: root, overrideConfigFile: true,
      overrideConfig: [{
        files: ['**/*.ts'], languageOptions: { parser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
        plugins: { 'clean-architecture': plugin }, settings: { 'clean-architecture': architecture },
        rules: { 'clean-architecture/no-outer-types-in-contracts': ['error', { maxTypeNodes: 10 }] },
      }],
    });
    await expect(eslint.lintFiles([file('application/contracts-large.ts')])).rejects.toThrow('maxTypeNodes');
  });
  it('handles a representative project without rebuilding the graph per rule', () => {
    const files: Record<string, string> = { 'b/index.ts': 'export interface Port { read(): number }' };
    for (let i = 0; i < 100; i++) files[`a/file-${i}.ts`] = 'import type { Port } from "../b/index.js";';
    const config = project(files);
    let graphA: unknown, graphB: unknown;
    const probe = { meta: { schema: [] }, create(context: unknown) {
      return { Program() { graphA = projectGraph(context as Context); graphB = projectGraph(context as Context); } };
    } };
    const started = performance.now();
    const result = new Linter({ cwd: config.root }).verify(files['a/file-0.ts'] ?? '', [{
      files: ['**/*.ts'], languageOptions: { parser }, plugins: { probe: { rules: { graph: probe } } },
      settings: { 'clean-architecture': config }, rules: { 'probe/graph': 'error' },
    }], { filename: `${config.root}/a/file-0.ts` });
    expect(result).toEqual([]);
    expect(graphA).toBe(graphB);
    expect(performance.now() - started).toBeLessThan(10000);
  });
});
