import { createRule, report } from '../utils/create-rule.js';
import { architectureOf, componentOf } from '../utils/config.js';
import { dependencyVisitors } from '../utils/dependencies.js';

export default createRule({
  name: 'no-mixed-actor-dependencies', description: 'Review modules depending on multiple declared actor groups',
  chapters: [7, 13], principle: 'Single Responsibility and Common Closure', reliability: 'heuristic', scopes: ['components'],
  limitations: 'Actors must be explicitly assigned to components. Multiple actor dependencies are a review signal, not proof of multiple reasons to change. Orchestration may legitimately combine actors.',
  create(context) {
    const config = architectureOf(context), actors = new Set<string>();
    return dependencyVisitors(context, dependency => {
      const actor = dependency.target ? componentOf(config, dependency.target)?.actor : undefined;
      if (!actor || actors.has(actor)) return;
      actors.add(actor);
      if (actors.size > 1) report(context, dependency.node, `Module couples declared actors ${[...actors].sort().join(', ')}; review responsibility boundary`, [7, 13]);
    });
  },
});
