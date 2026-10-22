import ts from 'typescript';
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, report } from '../utils/create-rule.js';
import { typeServices } from '../utils/types.js';

export default createRule({
  name: 'prefer-polymorphic-dispatch', description: 'Review repeated subtype dispatch on the same abstraction',
  chapters: [5, 8, 9], principle: 'Open–Closed and substitution', analysis: 'types', reliability: 'heuristic',
  limitations: 'Only repeated instanceof checks of distinct proper subtypes on the same symbol in one function. Does not ban switches or prove OCP/LSP violations. Error handling excluded.',
  create(context) {
    const { checker, toTS } = typeServices(context);
    const functions = new Map<TSESTree.Node, Map<ts.Symbol, Set<ts.Type>>>();
    return { BinaryExpression(node) {
      if (node.operator !== 'instanceof' || node.left.type !== 'Identifier') return;
      let owner: TSESTree.Node | undefined = node.parent;
      while (owner && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(owner.type)) owner = owner.parent;
      if (!owner) return;
      const left = toTS.get(node.left), symbol = checker.getSymbolAtLocation(left), type = checker.getTypeAtLocation(left);
      const constructor = checker.getTypeAtLocation(toTS.get(node.right));
      const signature = constructor.getConstructSignatures()[0];
      if (!symbol || !signature || type.isUnionOrIntersection() || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return;
      const subtype = checker.getReturnTypeOfSignature(signature);
      if (type.getSymbol()?.name === 'Error' || !checker.isTypeAssignableTo(subtype, type) || checker.isTypeAssignableTo(type, subtype)) return;
      let group = functions.get(owner);
      if (!group) { group = new Map(); functions.set(owner, group); }
      let seen = group.get(symbol);
      if (!seen) { seen = new Set(); group.set(symbol, seen); }
      const previous = seen.size;
      seen.add(subtype);
      if (previous === 1 && seen.size === 2) report(context, node, 'Repeated subtype dispatch may make extensions modify this consumer; consider polymorphism', [5, 8, 9]);
    } };
  },
});
