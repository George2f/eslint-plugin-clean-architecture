import { createRule, report } from '../utils/create-rule.js';
import { architecture, inCore, isVolatile } from '../utils/config.js';
import { declarationsOf, typeServices } from '../utils/types.js';
import type { TSESTree } from '@typescript-eslint/utils';

export default createRule({
  name: 'no-volatile-inheritance', description: 'Keep policy independent of volatile concrete base classes',
  chapters: [11, 32], principle: 'Dependency Inversion', analysis: 'types', scopes: ['core', 'volatile'],
  limitations: 'Uses resolved superclass declaration and explicit volatility classification. Stable concrete base classes are allowed.',
  create(context) {
    typeServices(context);
    const config = architecture(context);
    if (!inCore(config, context.physicalFilename)) return {};
    const check = (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): void => {
      if (node.superClass && declarationsOf(context, node.superClass).some(declaration => isVolatile(config, '', declaration.getSourceFile().fileName))) {
        report(context, node.superClass, 'Do not derive policy from a volatile concrete implementation', [11, 32]);
      }
    };
    return { ClassDeclaration: check, ClassExpression: check };
  },
});
