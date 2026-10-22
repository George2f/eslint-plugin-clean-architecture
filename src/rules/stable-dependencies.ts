import { createRule, report } from '../utils/create-rule.js';
import { architecture, componentOf } from '../utils/config.js';
import { dependencyVisitors } from '../utils/dependencies.js';
import { projectGraph } from '../utils/project.js';

export default createRule({
  name: 'stable-dependencies', description: 'Warn when dependencies point toward a less stable component',
  chapters: [14], principle: 'Stable Dependencies', analysis: 'project', reliability: 'metric', scopes: ['components', 'project'],
  limitations: 'Module-based adaptation, not the book’s class-based metric. Only declared components scored. Requires full-scope lint without ESLint result caching.',
  create(context) {
    const config = architecture(context);
    let metrics: ReturnType<typeof projectGraph>['metrics'] | undefined;
    return dependencyVisitors(context, dependency => {
      if (!dependency.target) return;
      const from = componentOf(config, context.physicalFilename), to = componentOf(config, dependency.target);
      if (!from || !to || from.name === to.name) return;
      metrics ??= projectGraph(context).metrics;
      const a = metrics.get(from.name), b = metrics.get(to.name);
      if (a && b && b.instability - a.instability > (context.options[0]?.threshold ?? 0)) {
        report(context, dependency.node, `${from.name} (I=${a.instability.toFixed(3)}) depends on less stable ${to.name} (I=${b.instability.toFixed(3)})`, [14]);
      }
    });
  },
});
