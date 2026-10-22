import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import plugin, { createConfig, createFrontendConfig, defineArchitecture, rules } from '../dist/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
const catalog = JSON.parse(readFileSync(new URL('../dist/rules.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(plugin.meta.name, pkg.name);
assert.equal(plugin.meta.version, pkg.version);
assert.equal(cjs.default, cjs);
assert.deepEqual(Object.keys(cjs.rules), Object.keys(rules));
assert.deepEqual(Object.keys(cjs.configs), Object.keys(plugin.configs));
assert.equal(typeof cjs.createConfig, 'function');
assert.equal(typeof cjs.createFrontendConfig, 'function');
assert.equal(typeof cjs.defineArchitecture, 'function');
assert.deepEqual(catalog.rules.map(rule => rule.name), Object.keys(rules));
for (const entry of catalog.rules) {
  assert.ok(entry.chapters.length && entry.principle && entry.limitations && entry.url);
}
assert.equal(typeof createConfig, 'function');
assert.equal(typeof createFrontendConfig, 'function');
assert.equal(typeof defineArchitecture, 'function');
for (const name of ['recommended', 'strict', 'strictest', 'recommended-type-checked', 'strict-type-checked', 'strictest-type-checked',
  'frontend', 'frontend-strict', 'frontend-type-checked', 'frontend-strict-type-checked']) {
  assert.ok(plugin.configs[name], `Missing preset ${name}`);
  assert.ok(Object.keys(plugin.configs[name].rules).length > 0, `Empty preset ${name}`);
}
assert.equal(typeof createFrontendConfig, 'function');
assert.ok(!readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8').includes('sourceMappingURL'));
for (const file of ['index.d.ts', 'index.d.cts']) {
  const declaration = readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8');
  assert.ok(declaration.includes('createConfig'));
  for (const [, specifier] of declaration.matchAll(/from ['"]([^'"]+)['"]/g)) {
    assert.ok(specifier in { ...pkg.dependencies, ...pkg.peerDependencies }, `Undeclared public type dependency: ${specifier}`);
  }
}
console.log(`distribution verified: ESM/CJS/types/catalog, ${catalog.rules.length} rules`);
