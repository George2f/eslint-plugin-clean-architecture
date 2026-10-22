import { dependencyRule } from '../utils/dependencies.js';
import { hasRole } from '../utils/config.js';

export default dependencyRule({
  name: 'humble-view-dependencies', description: 'Keep views behind their presentation boundary',
  chapters: [23], principle: 'Humble Object', scopes: ['roles'],
  check(config, source, dependency) {
    if (!dependency.target || !hasRole(config, source, 'view')) return;
    const target = dependency.target;
    if ((['entity', 'use-case', 'repository'] as const).some(role => hasRole(config, target, role))) {
      return `View must use its presenter/view model rather than ${dependency.specifier}`;
    }
  },
});
