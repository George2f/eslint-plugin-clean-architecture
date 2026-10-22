import { isBuiltin } from 'node:module';
import { dependencyRule } from '../utils/dependencies.js';
import { inCore } from '../utils/config.js';

export default dependencyRule({
  name: 'no-unresolved-boundary-dependencies', description: 'Expose unresolved dependency targets in protected policy',
  chapters: [18, 22], principle: 'Auditable architectural boundaries', scopes: ['core'],
  limitations: 'Opt-in completeness check. Ambient or virtual modules require resolver support or an ESLint override. Node built-ins are recognized.',
  check(config, source, dependency) {
    if (inCore(config, source) && !dependency.target && !isBuiltin(dependency.specifier)) {
      return `Cannot resolve ${dependency.specifier}; architectural target cannot be verified`;
    }
  },
});
