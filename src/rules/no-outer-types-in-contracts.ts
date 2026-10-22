import { contractRule } from '../utils/contract-rule.js';
import { layerOf } from '../utils/config.js';

export default contractRule('no-outer-types-in-contracts', 'Keep outer types out of inner exported contracts',
  [20, 22], 'Dependency Rule and request/response models', ['layers'],
  (config, source, _type, declarations) => {
    const from = layerOf(config, source);
    if (!from) return;
    for (const declaration of declarations) {
      const to = layerOf(config, declaration.getSourceFile().fileName);
      if (to && to.name !== from.name && !from.allow.includes(to.name)) return `contract exposes type owned by forbidden layer ${to.name}`;
    }
  });
