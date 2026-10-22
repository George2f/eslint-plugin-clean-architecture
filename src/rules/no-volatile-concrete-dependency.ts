import { dependencyRule } from '../utils/dependencies.js';
import { inCore, isVolatile } from '../utils/config.js';

export default dependencyRule({
  name: 'no-volatile-concrete-dependency', description: 'Prevent policy dependencies on declared volatile implementations',
  chapters: [11], principle: 'Dependency Inversion', scopes: ['core', 'volatile'],
  check(config, source, dependency) {
    if (inCore(config, source) && isVolatile(config, dependency.specifier, dependency.target)) {
      return `Policy may not reference volatile implementation ${dependency.specifier}; stable concrete facilities remain allowed`;
    }
  },
});
