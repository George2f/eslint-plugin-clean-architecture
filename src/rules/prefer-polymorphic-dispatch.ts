import { createRule, report } from '../utils/create-rule.js';
import type { TSESTree } from '@typescript-eslint/utils';

const builtinErrors = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AggregateError']);

function constructorName(node: TSESTree.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && node.property.type === 'Identifier') return node.property.name;
  return undefined;
}

export default createRule({
  name: 'prefer-polymorphic-dispatch', description: 'Review repeated subtype dispatch on the same value',
  chapters: [5, 8, 9], principle: 'Open–Closed and substitution', analysis: 'ast', reliability: 'heuristic',
  limitations: 'Detects two or more instanceof checks against the same identifier in one function. Does not prove OCP/LSP or ban every instanceof/switch. Built-in error dispatch is ignored.',
  create(context) {
    const functions = new Map<TSESTree.Node, Map<string, Set<string>>>();
    return { BinaryExpression(node) {
      if (node.operator !== 'instanceof' || node.left.type !== 'Identifier') return;
      const subtype = constructorName(node.right);
      if (!subtype || builtinErrors.has(subtype)) return;
      let owner: TSESTree.Node | undefined = node.parent;
      while (owner && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(owner.type)) owner = owner.parent;
      if (!owner) return;
      let group = functions.get(owner);
      if (!group) { group = new Map(); functions.set(owner, group); }
      let seen = group.get(node.left.name);
      if (!seen) { seen = new Set(); group.set(node.left.name, seen); }
      const previous = seen.size;
      seen.add(subtype);
      if (previous === 1 && seen.size === 2) {
        report(context, node, 'Repeated subtype dispatch may make extensions modify this consumer; consider polymorphism', [5, 8, 9]);
      }
    } };
  },
});
