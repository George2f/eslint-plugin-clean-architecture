import { createRule, report } from '../utils/create-rule.js';
import { architecture, matches, relative } from '../utils/config.js';

export default createRule({
  name: 'no-mutable-module-state', description: 'Keep reassignable bindings out of immutable module scope',
  chapters: [6], principle: 'Segregation of Mutability', scopes: ['immutable'],
  limitations: 'Checks module-scope let/var bindings, not deep immutability of const objects. Function-local bindings handled by the mutation rule when changed.',
  create(context) {
    const config = architecture(context);
    if (!matches(relative(config, context.physicalFilename), config.immutable)) return {};
    return { VariableDeclaration(node) {
      if (node.kind === 'const' || node.kind === 'using' || node.kind === 'await using') return;
      let scope = context.sourceCode.getScope(node);
      while (scope.type === 'block' && scope.upper) scope = scope.upper;
      if (scope.type === 'module' || scope.type === 'global') {
        report(context, node, 'Use immutable module bindings or move changing state to a mutable component', [6]);
      }
    } };
  },
});
