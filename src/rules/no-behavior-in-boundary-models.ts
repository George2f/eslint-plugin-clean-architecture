import ts from 'typescript';
import { contractRule } from '../utils/contract-rule.js';

export default contractRule('no-behavior-in-boundary-models', 'Review behavior exposed through designated transfer models',
  [20, 22], 'Simple boundary data', [], (_config, _source, type, declarations) => {
    if (declarations.some(declaration => ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)) &&
      type.getCallSignatures().length > 0) return 'transfer model exposes callable behavior; consider plain boundary data';
  }, 'heuristic', ' Callable models and behavior-bearing value objects may be intentional; opt-in warning.');
