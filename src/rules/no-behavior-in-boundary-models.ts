import typescript from 'typescript';
import { contractRule } from '../utils/contract-rule.js';

export default contractRule({
  name: 'no-behavior-in-boundary-models', description: 'Review behavior exposed through designated transfer models',
  chapters: [20, 22], principle: 'Simple boundary data', scopes: [], match: (_config, _source, type, declarations) => {
    const hasMethod = declarations.some(declaration => typescript.isMethodDeclaration(declaration) || typescript.isMethodSignature(declaration));
    const hasCallSignature = type.getCallSignatures().length > 0;
    if (hasMethod && hasCallSignature) return 'transfer model exposes callable behavior; consider plain boundary data';
  },
  reliability: 'heuristic',
  extraLimitations: ' Callable models and behavior-bearing value objects may be intentional; opt-in warning.',
});
