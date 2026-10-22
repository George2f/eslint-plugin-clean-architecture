import ts from 'typescript';
import { createRule, report } from '../utils/create-rule.js';
import { containingClass, hasModifier, typeServices } from '../utils/types.js';

export default createRule({
  name: 'no-concrete-method-override', description: 'Prefer implementing abstractions over overriding inherited implementations',
  chapters: [11], principle: 'Stable abstractions', analysis: 'types', reliability: 'heuristic',
  limitations: 'Book design guidance, not proof of a defect. Framework hooks and intentional template methods may require overrides. Ignores constructors, static methods, and accessors.',
  create(context) {
    const { checker, toTS } = typeServices(context);
    return { MethodDefinition(node) {
      if (node.kind !== 'method' || node.static || node.computed) return;
      const method = toTS.get(node), owner = containingClass(method.parent);
      if (!owner) return;
      const ownerType = checker.getTypeAtLocation(owner) as ts.InterfaceType;
      const name = node.key.type === 'Identifier' ? node.key.name : String('value' in node.key ? node.key.value : '');
      const queue = [...(ownerType.getBaseTypes() ?? [])], seen = new Set<ts.Type>();
      for (const base of queue) {
        if (seen.has(base)) continue;
        seen.add(base);
        const member = checker.getPropertyOfType(base, name);
        if (member) {
          if (member.declarations?.some(declaration => ts.isMethodDeclaration(declaration) &&
            Boolean(declaration.body) && !hasModifier(declaration, ts.SyntaxKind.AbstractKeyword))) {
            report(context, node, `Method ${name} overrides an inherited concrete implementation`, [11]);
          }
          return;
        }
        queue.push(...(base.getBaseTypes() ?? []));
      }
    } };
  },
});
