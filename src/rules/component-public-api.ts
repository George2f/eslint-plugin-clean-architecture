import { dependencyRule } from '../utils/dependencies.js';
import { componentOf, matches, relative } from '../utils/config.js';

export default dependencyRule({
  name: 'component-public-api', description: 'Access other components only through declared entry points',
  chapters: [12, 17, 34], principle: 'Component encapsulation', scopes: ['components'],
  check(config, source, dependency) {
    if (!dependency.target) return;
    const from = componentOf(config, source), to = componentOf(config, dependency.target);
    if (to && from?.name !== to.name && !matches(relative(config, dependency.target), to.public)) {
      return `Access ${to.name} through its public entry points, not ${dependency.specifier}`;
    }
  },
});
