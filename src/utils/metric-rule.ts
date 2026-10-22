import { architectureOf, componentOf } from './config.js';
import { createRule, report } from './create-rule.js';
import { projectGraph, type Metric } from './project.js';
import type { Rule } from '../types.js';

export function metricRule(name: string, principle: string, defaultThreshold: number,
  check: (metric: Metric, threshold: number) => boolean): Rule {
  return createRule({
    name, description: `Check ${principle} using explicitly adapted module metrics`,
    chapters: [14], principle, analysis: 'project', reliability: 'metric', scopes: ['components', 'project'],
    limitations: 'TypeScript adaptation: units are source modules, not classes. Imports to undeclared/external components are not scored. Type-only dependencies count by default. Threshold is advisory. Requires full-scope lint without ESLint result caching.',
    create(context) {
      return { Program(node) {
        const config = architectureOf(context), component = componentOf(config, context.physicalFilename);
        if (!component) return;
        const graph = projectGraph(context);
        const componentName = component.name;
        const first = [...graph.files.keys()].filter(file => componentOf(config, file)?.name === componentName).sort()[0];
        if (first !== context.physicalFilename) return;
        const metric = graph.metrics.get(componentName);
        const threshold = context.options[0]?.threshold ?? defaultThreshold;
        if (metric && metric.incoming + metric.outgoing > 0 && check(metric, threshold)) {
          report(context, node, `${componentName}: A=${metric.abstractness.toFixed(3)}, I=${metric.instability.toFixed(3)}, D=${metric.distance.toFixed(3)} (${principle})`, [14]);
        }
      } };
    },
  });
}
