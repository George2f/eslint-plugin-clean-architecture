import { createRule, report } from '../utils/create-rule.js';
import { architecture, inCore, isVolatile } from '../utils/config.js';
import { declarationsOf, typeServices } from '../utils/types.js';

export default createRule({
  name: 'no-volatile-construction', description: 'Keep construction of volatile concrete dependencies outside policy',
  chapters: [11, 26], principle: 'Dependency Inversion and factories', analysis: 'types', scopes: ['core', 'volatile'],
  limitations: 'Only explicitly classified volatile declarations are prohibited. Factory-returned values and runtime injection are not reconstructed.',
  create(context) {
    typeServices(context);
    const config = architecture(context);
    if (!inCore(config, context.physicalFilename)) return {};
    return { NewExpression(node) {
      const bad = declarationsOf(context, node.callee).find(declaration => isVolatile(config, '', declaration.getSourceFile().fileName));
      if (bad) report(context, node, 'Construct volatile implementation in Main/factory, not protected policy', [11, 26]);
    } };
  },
});
