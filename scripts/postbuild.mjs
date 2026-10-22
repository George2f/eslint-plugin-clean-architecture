import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.cjs', import.meta.url);
const marker = 'module.exports = Object.assign(module.exports.default, {';
const source = readFileSync(file, 'utf8');

if (!source.includes(marker)) {
  writeFileSync(file, `${source}
module.exports = Object.assign(module.exports.default, {
  createConfig: module.exports.createConfig,
  defineArchitecture: module.exports.defineArchitecture,
  rules: module.exports.rules,
  default: module.exports.default,
});
`);
  console.log('postbuild: enabled direct CommonJS require with named helpers');
} else {
  console.log('postbuild: CommonJS interop already present');
}
