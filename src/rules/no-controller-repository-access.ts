import { dependencyRule } from '../utils/dependencies.js';
import { hasRole } from '../utils/config.js';

export default dependencyRule({
  name: 'no-controller-repository-access', description: 'Prevent controllers bypassing application policy',
  chapters: [34], principle: 'Enforced component boundaries', scopes: ['roles'],
  check(config, source, dependency) {
    if (dependency.target && hasRole(config, source, 'controller') && hasRole(config, dependency.target, 'repository')) {
      return `Controller must access application policy rather than repository ${dependency.specifier}`;
    }
  },
});
