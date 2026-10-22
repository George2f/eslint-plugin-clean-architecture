import { contractRule } from '../utils/contract-rule.js';
import { targetMatches } from '../utils/config.js';

export default contractRule({
  name: 'boundary-model-dependencies', description: 'Keep infrastructure representations out of boundary contracts',
  chapters: [20, 22, 30, 31], principle: 'Infrastructure-independent boundary data', scopes: ['infrastructure'],
  match: (config, _source, _type, declarations) => {
    for (const declaration of declarations) {
      const file = declaration.getSourceFile().fileName;
      for (const [kind, patterns] of Object.entries(config.infrastructure ?? {})) {
        if (targetMatches(config, patterns, '', file)) return `boundary contract exposes ${kind} representation`;
      }
    }
  },
});
