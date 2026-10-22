import ts from 'typescript';
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, report } from '../utils/create-rule.js';
import { typeServices } from '../utils/types.js';

export default createRule({
  name: 'prefer-segregated-interfaces', description: 'Review broad interfaces consumed through a smaller nonescaping member set',
  chapters: [10, 13], principle: 'Interface Segregation and Common Reuse', analysis: 'types', reliability: 'heuristic',
  limitations: 'Only identifier parameters with project-owned interfaces containing methods and exclusively static member accesses. Data-only interfaces, library interfaces, escaping, destructured, and dynamically accessed parameters are skipped. Partial usage does not prove poor interface design.',
  create(context) {
    const { checker, program, toTS } = typeServices(context);
    const check = (node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression): void => {
      for (const parameter of node.params) {
        if (parameter.type !== 'Identifier') continue;
        const type = checker.getTypeAtLocation(toTS.get(parameter));
        const symbol = type.getSymbol();
        if (!symbol || !(symbol.flags & ts.SymbolFlags.Interface)) continue;
        const declarations = symbol.getDeclarations() ?? [];
        const external = (declaration: ts.Declaration) => program.isSourceFileDefaultLibrary(declaration.getSourceFile()) ||
          declaration.getSourceFile().fileName.replaceAll('\\', '/').includes('/node_modules/');
        if (!declarations.length || declarations.every(external)) continue;
        const properties = checker.getPropertiesOfType(type);
        if (!properties.some(property => property.declarations?.some(declaration =>
          ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)))) continue;
        const variable = context.sourceCode.getDeclaredVariables(node).find(item => item.name === parameter.name);
        if (!variable?.references.length) continue;
        const used = new Set<string>();
        let escaped = false;
        for (const reference of variable.references) {
          const parent = reference.identifier.parent;
          if (parent?.type !== 'MemberExpression' || parent.object !== reference.identifier || parent.computed || parent.property.type !== 'Identifier') { escaped = true; break; }
          used.add(parent.property.name);
        }
        if (!escaped && used.size && used.size < properties.length) {
          report(context, parameter, `Consumer uses ${used.size}/${properties.length} members of ${type.getSymbol()?.name}; consider a client-specific interface`, [10, 13]);
        }
      }
    };
    return { 'FunctionDeclaration:exit': check, 'FunctionExpression:exit': check, 'ArrowFunctionExpression:exit': check };
  },
});
