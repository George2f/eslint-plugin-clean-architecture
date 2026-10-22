import { createRule, report } from '../utils/create-rule.js';
import { architectureOf, matches, relative } from '../utils/config.js';
import { knownMutation } from '../utils/mutation.js';

export default createRule({
  name: 'no-mutation-in-immutable-modules', description: 'Detect explicit mutation in declared immutable components',
  chapters: [6], principle: 'Segregation of Mutability', scopes: ['immutable'],
  limitations: 'Detects assignments, updates, deletion, and known mutators on locally identifiable arrays/standard collections. Does not prove purity, track arbitrary aliases, or identify unknown side effects.',
  create(context) {
    const config = architectureOf(context);
    if (!matches(relative(config, context.physicalFilename), config.immutable)) return {};
    const mutation = (node: import('@typescript-eslint/utils').TSESTree.Node): void => report(context, node, 'Mutation belongs outside this designated immutable module', [6]);
    return {
      AssignmentExpression: mutation,
      UpdateExpression: mutation,
      UnaryExpression(node) { if (node.operator === 'delete') mutation(node); },
      CallExpression(node) { if (knownMutation(context, node)) mutation(node); },
    };
  },
});
