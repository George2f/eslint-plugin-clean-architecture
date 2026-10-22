import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, report } from '../utils/create-rule.js';
import { architecture, hasRole } from '../utils/config.js';

export default createRule({
  name: 'no-view-data-formatting', description: 'Review presentation formatting left in designated humble views',
  chapters: [23], principle: 'Presenters and Views', reliability: 'heuristic', scopes: ['roles'],
  limitations: 'Recognizes formatting method names in JSX or returned values, not arbitrary business logic. Formula/date arithmetic and non-rendered helpers are ignored. Test files are excluded unless analyzeTests is enabled.',
  create(context) {
    if (!hasRole(architecture(context), context.physicalFilename, 'view')) return {};
    const rendered = (node: TSESTree.Node): boolean => {
      let child = node;
      for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
        if (parent.type === 'JSXExpressionContainer' || parent.type === 'JSXAttribute' || parent.type === 'ReturnStatement') return true;
        if (parent.type === 'ArrowFunctionExpression' && parent.body === child) return true;
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type)) return false;
      }
      return false;
    };
    return { CallExpression(node) {
      if (!rendered(node)) return;
      if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier' &&
        ['toFixed', 'toPrecision', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toISOString'].includes(node.callee.property.name)) {
        report(context, node, 'Consider preparing formatted display data in the presenter rather than the humble view', [23]);
      }
    } };
  },
});
