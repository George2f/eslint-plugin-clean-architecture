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
      return `${relative(config, source)} in ${from.name} may not depend on ${to.name}: ${dependency.specifier}`;
    }
  },
});
