import { dependencyRule } from '../utils/dependencies.js';
import { componentOf, matches, relative } from '../utils/config.js';

export default dependencyRule({
  name: 'use-case-isolation', description: 'Protect independently declared use-case internals',
  chapters: [16], principle: 'Use-case independence', scopes: ['components'],
  check(config, source, dependency) {
    if (!dependency.target) return;
    const from = componentOf(config, source), to = componentOf(config, dependency.target);
    if (from?.useCase && to?.useCase && from.useCase !== to.useCase &&
      !matches(relative(config, dependency.target), to.public)) {
      return `Use case ${from.useCase} may not access internals of ${to.useCase}`;
    }
  },
});
