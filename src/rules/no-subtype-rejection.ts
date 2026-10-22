import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, report } from '../utils/create-rule.js';
import { hasTypeServices, containingClass, typeServices } from '../utils/types.js';

function isThrowOnlyMethod(node: TSESTree.MethodDefinition): boolean {
  const body = node.value.body;
  if (!body || body.body.length !== 1) return false;
  return body.body[0]?.type === 'ThrowStatement';
}

export default createRule({
  name: 'no-subtype-rejection', description: 'Review inherited operations implemented only by throwing',
  chapters: [9], principle: 'Liskov Substitution', analysis: 'ast', reliability: 'heuristic',
  limitations: 'Reports inherited methods implemented only by throwing. JavaScript analysis only sees a base class declared in the same file; imported bases require TypeScript analysis. An always-throwing implementation may satisfy its contract.',
  create(context) {
    if (hasTypeServices(context)) {
      const { checker, toTS } = typeServices(context);
      return { MethodDefinition(node) {
        if (node.kind !== 'method' || node.static || node.computed || node.key.type !== 'Identifier' || !isThrowOnlyMethod(node)) return;
        const tsNode = toTS.get(node);
        const owner = containingClass(tsNode.parent);
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
    }
    const classes = new Map<string, TSESTree.ClassDeclaration>();
    const interfaces = new Map<string, Set<string>>();
    return {
      ClassDeclaration(node) {
        if (node.id) classes.set(node.id.name, node);
      },
      TSInterfaceDeclaration(node) {
        const methods = new Set<string>();
        for (const member of node.body.body) {
          if (member.type === 'TSMethodSignature' && member.key.type === 'Identifier') methods.add(member.key.name);
        }
        interfaces.set(node.id.name, methods);
      },
      'Program:exit'() {
        for (const derived of classes.values()) {
          const base = derived.superClass?.type === 'Identifier' ? classes.get(derived.superClass.name) : undefined;
          const implemented = new Set(derived.implements?.flatMap(clause => clause.expression.type === 'Identifier'
            ? [...(interfaces.get(clause.expression.name) ?? [])] : []) ?? []);
          if (!base && !implemented.size) continue;
          for (const member of derived.body.body) {
            if (member.type !== 'MethodDefinition' || member.kind !== 'method' || member.static || member.computed ||
              member.key.type !== 'Identifier' || !isThrowOnlyMethod(member)) continue;
            const methodName = member.key.name;
            const inherited = implemented.has(methodName) || Boolean(base?.body.body.some(candidate => candidate.type === 'MethodDefinition' &&
              candidate.kind === 'method' && !candidate.static && !candidate.computed &&
              candidate.key.type === 'Identifier' && candidate.key.name === methodName && candidate.value.body));
            if (inherited) report(context, member, `Inherited operation ${methodName} always throws; verify substitutability contract`, [9]);
          }
        }
      },
    };
  },
});
