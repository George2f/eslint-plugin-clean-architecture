import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import plugin, { createConfig, rules } from '../dist/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
const catalog = JSON.parse(readFileSync(new URL('../dist/rules.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(plugin.meta.name, pkg.name);
assert.equal(plugin.meta.version, pkg.version);
assert.deepEqual(Object.keys(cjs.default.rules), Object.keys(rules));
assert.deepEqual(catalog.rules.map(rule => rule.name), Object.keys(rules));
for (const entry of catalog.rules) {
  assert.ok(entry.chapters.length && entry.principle && entry.limitations && entry.url);
}
assert.equal(typeof cjs.createConfig, 'function');
assert.equal(typeof createConfig, 'function');
for (const file of ['index.d.ts', 'index.d.cts']) {
  const declaration = readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8');
  assert.ok(declaration.includes('createConfig'));
  for (const [, specifier] of declaration.matchAll(/from ['"]([^'"]+)['"]/g)) {
    assert.ok(specifier in { ...pkg.dependencies, ...pkg.peerDependencies }, `Undeclared public type dependency: ${specifier}`);
  }
}
console.log(`distribution verified: ESM/CJS/types/catalog, ${catalog.rules.length} rules`);
