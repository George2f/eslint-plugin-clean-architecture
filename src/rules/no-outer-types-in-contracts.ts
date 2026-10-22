import { contractRule } from '../utils/contract-rule.js';
import { layerOf } from '../utils/config.js';

export default contractRule({
  name: 'no-outer-types-in-contracts', description: 'Keep outer types out of inner exported contracts',
  chapters: [20, 22], principle: 'Dependency Rule and request/response models', scopes: ['layers'],
  match: (config, source, _type, declarations) => {
    const from = layerOf(config, source);
    if (!from) return;
    for (const declaration of declarations) {
      const declarationFile = declaration.getSourceFile();
      const to = layerOf(config, declarationFile.fileName);
      if (to && to.name !== from.name && !from.allow.includes(to.name)) return `contract exposes type owned by forbidden layer ${to.name}`;
    }
  },
});
