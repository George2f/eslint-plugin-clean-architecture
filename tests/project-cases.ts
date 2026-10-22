import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import * as parser from '@typescript-eslint/parser';
import plugin from '../src/index.js';
import type { Architecture } from '../src/types.js';
import { createLinter } from './eslint-compat.js';

const temporary: string[] = [];
afterEach(() => { for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

export function project(files: Record<string, string>): Architecture {
  const root = fs.mkdtempSync(path.join(fileURLToPath(new URL('..', import.meta.url)), '.test-project-'));
  temporary.push(root);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return {
    root, project: { files: ['**/*.ts'] },
    components: ['a', 'b', 'c', 'd', 'e'].map(name => ({ name, files: [`${name}/**`], public: [`${name}/index.ts`] })),
  };
}

export function lintProject(config: Architecture, name: string, rule: string, text?: string, options: object = {}) {
  const filename = path.join(config.root, name);
  return createLinter({ cwd: config.root }).verify(text ?? fs.readFileSync(filename, 'utf8'), [{
    files: ['**/*.ts'], languageOptions: { parser }, plugins: { 'clean-architecture': plugin },
    settings: { 'clean-architecture': config }, rules: { [`clean-architecture/${rule}`]: ['error', options] },
  }], { filename });
}

export function testProjectRule(name: string): void {
  describe(name, () => {
    if (name === 'no-component-cycles') {
      it('reports a concrete cycle through a type-only re-export', () => {
        const config = project({ 'a/index.ts': 'export type { B } from "../b/index.js";', 'b/index.ts': 'import "../a/index.js"; export interface B {}' });
        expect(lintProject(config, 'a/index.ts', name)).toEqual([expect.objectContaining({ message: expect.stringContaining('a -> b -> a') })]);
        expect(lintProject(config, 'a/index.ts', name, undefined, { includeTypeOnly: false })).toEqual([]);
      });
      it('allows an acyclic graph and ignores intra-component cycles', () => {
        const config = project({ 'a/index.ts': 'import "./other.js"; import "../b/index.js";', 'a/other.ts': 'import "./index.js";', 'b/index.ts': 'export {};' });
        expect(lintProject(config, 'a/index.ts', name)).toEqual([]);
      });
      it('does not invent dependencies from shadowed require calls', () => {
        const config = project({ 'a/index.ts': 'export function f(require) { require("../b/index.js"); }', 'b/index.ts': 'import "../a/index.js";' });
        expect(lintProject(config, 'b/index.ts', name)).toEqual([]);
      });
      it('honors hoisted var bindings and loop-local require bindings', () => {
        const config = project({
          'a/index.ts': 'export function f() { require("../b/index.js"); if (true) { var require = custom; } } for (const require of []) { require("../b/index.js"); }',
          'b/index.ts': 'import "../a/index.js";',
        });
        expect(lintProject(config, 'b/index.ts', name)).toEqual([]);
      });
      it('invalidates snapshots when another source changes even with identical timestamps', () => {
        const config = project({ 'a/index.ts': 'import "../b/index.js";', 'b/index.ts': 'import "../a/index.js";' });
        const target = path.join(config.root, 'b/index.ts'), stat = fs.statSync(target);
        expect(lintProject(config, 'a/index.ts', name)).toHaveLength(1);
        fs.writeFileSync(target, 'export const b = 1;');
        fs.utimesSync(target, stat.atime, stat.mtime);
        expect(lintProject(config, 'a/index.ts', name)).toEqual([]);
      });
      it('includes unsaved current-file changes', () => {
        const config = project({ 'a/index.ts': 'export {};', 'b/index.ts': 'import "../a/index.js";' });
        expect(lintProject(config, 'a/index.ts', name)).toEqual([]);
        expect(lintProject(config, 'a/index.ts', name, 'import "../b/index.js";')).toHaveLength(1);
      });
      it('does not reuse a graph across projects', () => {
        const cyclic = project({ 'a/index.ts': 'import "../b/index.js";', 'b/index.ts': 'import "../a/index.js";' });
        const acyclic = project({ 'a/index.ts': 'import "../b/index.js";', 'b/index.ts': 'export {};' });
        expect(lintProject(cyclic, 'a/index.ts', name)).toHaveLength(1);
        expect(lintProject(acyclic, 'a/index.ts', name)).toEqual([]);
      });
      it('resolves NodeNext import and require conditions separately', () => {
        const config = project({
          'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"},"include":["**/*.ts"]}',
          'a/package.json': '{"type":"module"}', 'a/index.ts': 'import "dual";',
          'b/package.json': '{"name":"dual","type":"module","exports":{"import":"./import.js","require":"./require.js"}}',
          'b/import.ts': 'import "../a/index.js";', 'b/require.ts': 'export {};',
        });
        config.project = { tsconfig: 'tsconfig.json' };
        config.components = [
          { name: 'a', files: ['a/**'], public: ['a/index.ts'] },
          { name: 'b', files: ['b/import.ts'], public: ['b/import.ts'] },
          { name: 'c', files: ['b/require.ts'], public: ['b/require.ts'] },
        ];
        fs.mkdirSync(`${config.root}/node_modules`);
        fs.symlinkSync(`${config.root}/b`, `${config.root}/node_modules/dual`, 'junction');
        expect(lintProject(config, 'a/index.ts', name)).toHaveLength(1);
        expect(lintProject(config, 'a/index.ts', name, 'import dual = require("dual");')).toEqual([]);
      });
    } else if (name === 'stable-dependencies') {
      it('warns on dependency toward a less stable component', () => {
        const config = project({
          'a/index.ts': 'import "../b/index.js";', 'b/index.ts': 'import "../c/index.js";',
          'c/index.ts': 'export const value = 1;', 'd/index.ts': 'import "../a/index.js";', 'e/index.ts': 'import "../a/index.js";',
        });
        expect(lintProject(config, 'a/index.ts', name)).toEqual([expect.objectContaining({ message: expect.stringContaining('I=0.333') })]);
        expect(lintProject(config, 'a/index.ts', name, undefined, { threshold: 0.5 })).toEqual([]);
        expect(lintProject(config, 'b/index.ts', name)).toEqual([]);
      });
    } else {
      it('reports a stable concrete component, but permits an abstract one', () => {
        const config = project({ 'a/index.ts': 'import "../b/index.js";', 'b/index.ts': 'export class Concrete {}' });
        expect(lintProject(config, 'b/index.ts', name)).toEqual([expect.objectContaining({ message: expect.stringContaining('A=0.000, I=0.000, D=1.000') })]);
        fs.writeFileSync(path.join(config.root, 'b/index.ts'), 'export interface Port { read(): number }');
        expect(lintProject(config, 'b/index.ts', name)).toEqual([]);
      });
      it('does not flag isolated components', () => {
        const config = project({ 'a/index.ts': 'export class Concrete {}' });
        expect(lintProject(config, 'a/index.ts', name)).toEqual([]);
      });
    }
  });
}
