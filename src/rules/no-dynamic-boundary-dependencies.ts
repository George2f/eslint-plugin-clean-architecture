import { createRule, report } from '../utils/create-rule.js';
import { architectureOf, inCore } from '../utils/config.js';
import { dependencyVisitors } from '../utils/dependencies.js';

export default createRule({
  name: 'no-dynamic-boundary-dependencies', description: 'Require statically identifiable module targets in protected policy',
  chapters: [18, 22], principle: 'Auditable architectural boundaries', scopes: ['core'],
  limitations: 'Project enforcement policy, not a universal ban on dynamic loading. Only nonliteral import/require targets in designated core are reported.',
  create(context) {
    if (!inCore(architectureOf(context), context.physicalFilename)) return {};
    return dependencyVisitors(context, () => {}, node => report(context, node, 'Dynamic dependency target prevents boundary verification', [18, 22]));
  },
});
