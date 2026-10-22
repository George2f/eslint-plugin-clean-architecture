import ts from 'typescript';
import { createRule, report } from '../utils/create-rule.js';
import { architecture, hasRole, inCore, layerOf } from '../utils/config.js';
import { resolveDependency } from '../utils/dependencies.js';
import { dealias, hasTypeServices, typeServices } from '../utils/types.js';
import type { Architecture } from '../types.js';

function outside(config: Architecture, source: string, target: string): boolean {
  const from = layerOf(config, source), to = layerOf(config, target);
  return from && to ? from.name !== to.name && !from.allow.includes(to.name) : !inCore(config, target);
}

export default createRule({
  name: 'port-ownership', description: 'Keep ports consumed by protected policy on its side of the boundary',
  chapters: [11, 22], principle: 'Dependency Inversion and output ports', analysis: 'ast', scopes: ['core', 'roles'],
  limitations: 'Only explicitly designated port modules checked. In JavaScript, ownership comes from literal imports; type aliases behind re-exports are not resolved. An outer-owned interface is not universally invalid; this enforces declared inner ownership.',
  create(context) {
    const config = architecture(context);
    if (!inCore(config, context.physicalFilename)) return {};
    if (!hasTypeServices(context)) {
      return { ImportDeclaration(node) {
        if (node.source.type !== 'Literal') return;
        const target = resolveDependency(config, context.physicalFilename, String(node.source.value));
        if (!target || !hasRole(config, target, 'port') || !outside(config, context.physicalFilename, target)) return;
        report(context, node, `Port imported from ${String(node.source.value)} belongs outside this policy boundary`, [11, 22]);
      } };
    }
    const { checker, toTS } = typeServices(context);
    const seen = new Set<ts.Symbol>();
    return { Identifier(node) {
      const symbol = dealias(checker, checker.getSymbolAtLocation(toTS.get(node)));
      if (!symbol || !(symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) || seen.has(symbol)) return;
      const bad = symbol.declarations?.find(declaration => {
        const file = declaration.getSourceFile().fileName;
        return hasRole(config, file, 'port') && outside(config, context.physicalFilename, file);
      });
      if (bad) { seen.add(symbol); report(context, node, `Port ${symbol.name} belongs outside its consuming policy boundary`, [11, 22]); }
    } };
  },
});
