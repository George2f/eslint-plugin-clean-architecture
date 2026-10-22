import { dependencyRule } from '../utils/dependencies.js';
import { layerOf, relative } from '../utils/config.js';

export default dependencyRule({
  name: 'dependency-direction', description: 'Keep source dependencies within declared layer relationships',
  chapters: [18, 19, 22], principle: 'Dependency Rule', scopes: ['layers'],
  check(config, source, dependency) {
    const from = layerOf(config, source);
    if (!from || !dependency.target) return;
    const to = layerOf(config, dependency.target);
    if (to && to.name !== from.name && !from.allow.includes(to.name)) {
      const allowed = from.allow.length ? from.allow.join(', ') : 'none';
      return `${relative(config, source)} is ${from.name}; it may not depend on ${relative(config, dependency.target)} (${to.name}). Allowed layers: ${allowed}`;
    }
  },
});
