import { dependencyRule } from '../utils/dependencies.js';
import { inCore, targetMatches } from '../utils/config.js';

export default dependencyRule({
  name: 'no-core-infrastructure', description: 'Keep configured infrastructure implementations out of business policy',
  chapters: [20, 21, 29, 30, 31, 32], principle: 'Infrastructure independence', scopes: ['core', 'infrastructure'],
  check(config, source, dependency) {
    if (!inCore(config, source)) return;
    for (const [kind, patterns] of Object.entries(config.infrastructure ?? {})) {
      if (targetMatches(config, patterns, dependency.specifier, dependency.target)) {
        return `Core may not depend on ${kind} implementation ${dependency.specifier}; use an inner-owned port`;
      }
    }
  },
});
