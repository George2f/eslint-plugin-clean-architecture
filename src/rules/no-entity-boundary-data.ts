import { contractRule } from '../utils/contract-rule.js';
import { hasRole } from '../utils/config.js';

export default contractRule({
  name: 'no-entity-boundary-data', description: 'Keep entity instances out of designated boundary data',
  chapters: [20, 22], principle: 'Simple boundary data', scopes: ['roles'],
  match: (config, _source, _type, declarations) => {
    if (declarations.some(declaration => {
      const file = declaration.getSourceFile();
      return hasRole(config, file.fileName, 'entity');
    })) {
      return 'boundary data exposes an entity; use an independent request/response representation';
    }
  },
});
