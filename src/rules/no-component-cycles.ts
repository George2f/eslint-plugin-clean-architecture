import { createRule, report } from '../utils/create-rule.js';
import { architecture, componentOf } from '../utils/config.js';
import { dependencyVisitors } from '../utils/dependencies.js';
import { cyclePath, projectGraph } from '../utils/project.js';

export default createRule({
  name: 'no-component-cycles', description: 'Prevent cycles between declared components',
  chapters: [14], principle: 'Acyclic Dependencies', analysis: 'project', scopes: ['components', 'project'],
  limitations: 'Requires full-scope lint without ESLint result caching. Runtime-computed dependencies cannot be included. Intra-component file cycles are not component cycles.',
  create(context) {
    const config = architecture(context);
    return dependencyVisitors(context, dependency => {
      if (!dependency.target) return;
      const from = componentOf(config, context.physicalFilename), to = componentOf(config, dependency.target);
      if (!from || !to || from.name === to.name) return;
      const route = cyclePath(projectGraph(context), from.name, to.name);
      if (route) report(context, dependency.node, `Component cycle: ${route.join(' -> ')}`, [14]);
    });
  },
});
