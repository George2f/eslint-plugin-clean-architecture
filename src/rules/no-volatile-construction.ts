import { createRule, report } from '../utils/create-rule.js';
import { architectureOf, inCore, isVolatile } from '../utils/config.js';
import { resolveDependency } from '../utils/dependencies.js';
import { declarationsOf, hasTypeServices } from '../utils/types.js';
import type { Architecture, Context } from '../types.js';

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
  name: 'no-volatile-construction', description: 'Keep construction of volatile concrete dependencies outside policy',
  chapters: [11, 26], principle: 'Dependency Inversion and factories', analysis: 'ast', scopes: ['core', 'volatile'],
  limitations: 'Tracks literal default, named, and namespace imports. Aliases and dynamic requires are not reconstructed. TypeScript analysis is used when available; otherwise the imported module is classified directly.',
  create(context) {
    const config = architectureOf(context);
    if (!inCore(config, context.physicalFilename)) return {};
    const imported = importTargets(context, config);
    const typed = hasTypeServices(context);
    return { NewExpression(node) {
      if (typed) {
        const bad = declarationsOf(context, node.callee).find(declaration => {
          const file = declaration.getSourceFile();
          return isVolatile(config, '', file.fileName);
        });
        if (bad) report(context, node, 'Construct volatile implementation in Main/factory, not protected policy', [11, 26]);
        return;
      }
      let name;
      if (node.callee.type === 'Identifier') name = node.callee.name;
      else if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' &&
        node.callee.property.type === 'Identifier') name = node.callee.object.name;
      if (name && isVolatile(config, name, imported.get(name))) {
        report(context, node, 'Construct volatile implementation in Main/factory, not protected policy', [11, 26]);
      }
    } };
  },
});
