import { contractRule } from '../utils/contract-rule.js';
import { hasRole } from '../utils/config.js';

export default contractRule('no-entity-boundary-data', 'Keep entity instances out of designated boundary data',
  [20, 22], 'Simple boundary data', ['roles'],
  (config, _source, _type, declarations) => {
    if (declarations.some(declaration => hasRole(config, declaration.getSourceFile().fileName, 'entity'))) {
      return 'boundary data exposes an entity; use an independent request/response representation';
    }
  });
