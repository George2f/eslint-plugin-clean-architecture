import ts from 'typescript';
import { createRule, report } from '../utils/create-rule.js';
import { architecture, hasRole, inCore, layerOf } from '../utils/config.js';
import { dealias, typeServices } from '../utils/types.js';

export default createRule({
  name: 'port-ownership', description: 'Keep ports consumed by protected policy on its side of the boundary',
  chapters: [11, 22], principle: 'Dependency Inversion and output ports', analysis: 'types', scopes: ['core', 'roles'],
  limitations: 'Only explicitly designated port modules checked. An outer-owned interface is not universally invalid; this enforces declared inner ownership.',
  create(context) {
    const { checker, toTS } = typeServices(context), config = architecture(context);
    if (!inCore(config, context.physicalFilename)) return {};
    const seen = new Set<ts.Symbol>();
    return { Identifier(node) {
      const symbol = dealias(checker, checker.getSymbolAtLocation(toTS.get(node)));
      if (!symbol || !(symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) || seen.has(symbol)) return;
      const bad = symbol.declarations?.find(declaration => {
        const file = declaration.getSourceFile().fileName;
        if (!hasRole(config, file, 'port')) return false;
        const from = layerOf(config, context.physicalFilename), to = layerOf(config, file);
        return from && to ? from.name !== to.name && !from.allow.includes(to.name) : !inCore(config, file);
      });
      if (bad) { seen.add(symbol); report(context, node, `Port ${symbol.name} belongs outside its consuming policy boundary`, [11, 22]); }
    } };
  },
});
