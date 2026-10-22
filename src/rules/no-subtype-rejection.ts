import { createRule, report } from '../utils/create-rule.js';
import { containingClass, typeServices } from '../utils/types.js';

export default createRule({
  name: 'no-subtype-rejection', description: 'Review inherited operations implemented only by throwing',
  chapters: [9], principle: 'Liskov Substitution', analysis: 'types', reliability: 'heuristic',
  limitations: 'An always-throwing implementation may satisfy its contract. Reports only inherited/interface operations; cannot establish behavioral substitutability or pre/postconditions.',
  create(context) {
    const { checker, toTS } = typeServices(context);
    return { MethodDefinition(node) {
      if (node.kind !== 'method' || node.static || node.computed || node.key.type !== 'Identifier' ||
        node.value.body?.body.length !== 1 || node.value.body.body[0]?.type !== 'ThrowStatement') return;
      const owner = containingClass(toTS.get(node).parent);
      if (!owner) return;
      for (const clause of owner.heritageClauses ?? []) {
        for (const heritage of clause.types) {
          if (checker.getPropertyOfType(checker.getTypeAtLocation(heritage), node.key.name)) {
            report(context, node, `Inherited operation ${node.key.name} always throws; verify substitutability contract`, [9]);
            return;
          }
        }
      }
    } };
  },
});
