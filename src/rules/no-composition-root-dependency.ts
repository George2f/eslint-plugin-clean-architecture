import { dependencyRule } from '../utils/dependencies.js';
import { hasRole, isTest } from '../utils/config.js';

export default dependencyRule({
  name: 'no-composition-root-dependency', description: 'Keep production modules independent of Main',
  chapters: [26], principle: 'The Main Component', scopes: ['roles'],
  check(config, source, dependency) {
    if (dependency.target && !isTest(config, source) && !hasRole(config, source, 'composition') &&
      hasRole(config, dependency.target, 'composition')) return `Application code may not depend on composition root ${dependency.specifier}`;
  },
});
