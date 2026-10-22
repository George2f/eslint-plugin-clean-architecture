import { createRule, report } from '../utils/create-rule.js';
import { architecture, hasRole } from '../utils/config.js';

export default createRule({
  name: 'no-view-data-formatting', description: 'Review presentation formatting left in designated humble views',
  chapters: [23], principle: 'Presenters and Views', reliability: 'heuristic', scopes: ['roles'],
  limitations: 'Recognizes formatting method names, not arbitrary business logic. Methods with these names may be legitimate rendering operations. Opt-in warning.',
  create(context) {
    if (!hasRole(architecture(context), context.physicalFilename, 'view')) return {};
    return { CallExpression(node) {
      if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier' &&
        ['toFixed', 'toPrecision', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toISOString'].includes(node.callee.property.name)) {
        report(context, node, 'Consider preparing formatted display data in the presenter rather than the humble view', [23]);
      }
    } };
  },
});
