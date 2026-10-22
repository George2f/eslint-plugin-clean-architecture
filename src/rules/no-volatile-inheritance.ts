import { createRule, report } from '../utils/create-rule.js';
import { architectureOf, inCore, isVolatile } from '../utils/config.js';
import { resolveDependency } from '../utils/dependencies.js';
import { declarationsOf, hasTypeServices } from '../utils/types.js';
import type { Architecture, Context } from '../types.js';
import type { TSESTree } from '@typescript-eslint/utils';

function importTargets(context: Context, config: Architecture): Map<string, string | undefined> {
  const result = new Map<string, string | undefined>();
  for (const statement of context.sourceCode.ast.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.type !== 'Literal') continue;
    const target = resolveDependency(config, context.physicalFilename, String(statement.source.value));
    for (const item of statement.specifiers) result.set(item.local.name, target);
  }
  return result;
}

export default createRule({
  name: 'no-volatile-inheritance', description: 'Keep policy independent of volatile concrete base classes',
  chapters: [11, 32], principle: 'Dependency Inversion', analysis: 'ast', scopes: ['core', 'volatile'],
  limitations: 'Tracks literal default, named, and namespace imports. Aliases and dynamic requires are not reconstructed. TypeScript analysis is used when available; stable concrete base classes are allowed.',
  create(context) {
    const config = architectureOf(context);
    if (!inCore(config, context.physicalFilename)) return {};
    const imported = importTargets(context, config);
    const typed = hasTypeServices(context);
    const check = (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): void => {
      const superClass = node.superClass;
      if (!superClass) return;
      if (typed) {
        const superDeclarations = declarationsOf(context, superClass);
        const volatileBase = superDeclarations.some(declaration => {
          const file = declaration.getSourceFile();
          return isVolatile(config, '', file.fileName);
        });
        if (volatileBase) {
          report(context, superClass, 'Do not derive policy from a volatile concrete implementation', [11, 32]);
        }
        return;
      }
      let name;
      if (superClass.type === 'Identifier') name = superClass.name;
      else if (superClass.type === 'MemberExpression' && superClass.object.type === 'Identifier' &&
        superClass.property.type === 'Identifier') name = superClass.object.name;
      if (name && isVolatile(config, name, imported.get(name))) {
        report(context, superClass, 'Do not derive policy from a volatile concrete implementation', [11, 32]);
      }
    };
    return { ClassDeclaration: check, ClassExpression: check };
  },
});
