import { dependencyRule } from '../utils/dependencies.js';
import { isTest } from '../utils/config.js';

export default dependencyRule({
  name: 'no-production-test-dependency', description: 'Keep production independent of test implementation',
  chapters: [28], principle: 'The Test Boundary', scopes: ['tests'],
  check(config, source, dependency) {
    if (dependency.target && !isTest(config, source) && isTest(config, dependency.target)) {
      return `Production code may not depend on test implementation ${dependency.specifier}`;
    }
  },
});
