import { writeFileSync } from 'node:fs';
import plugin from '../dist/index.js';

const rules = Object.entries(plugin.rules).map(([name, rule]) => ({
  name,
  ...rule.meta.docs,
  configs: Object.entries(plugin.configs).filter(([, config]) => config.rules?.[`clean-architecture/${name}`]).map(([name]) => name),
  schema: rule.meta.schema,
  defaultOptions: rule.defaultOptions,
  fixable: false,
}));
writeFileSync(new URL('../dist/rules.json', import.meta.url), `${JSON.stringify({
  name: plugin.meta.name,
  version: plugin.meta.version,
  presets: plugin.configs,
  rules,
}, (key, value) => key === 'plugins' ? undefined : value, 2)}\n`);
console.log(`catalog: ${rules.length} rules`);
