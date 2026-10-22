import { createRule, report } from '../utils/create-rule.js';
import { architecture, hasRole, inCore, layerOf } from '../utils/config.js';
import { resolveDependency } from '../utils/dependencies.js';
import type { Architecture } from '../types.js';

function outside(config: Architecture, source: string, target: string): boolean {
  const from = layerOf(config, source), to = layerOf(config, target);
  return from && to ? from.name !== to.name && !from.allow.includes(to.name) : !inCore(config, target);
}

export default createRule({
  name: 'port-ownership', description: 'Keep ports consumed by protected policy on its side of the boundary',
  chapters: [11, 22], principle: 'Dependency Inversion and output ports', analysis: 'ast', scopes: ['core', 'roles'],
  limitations: 'Only explicitly designated port modules imported by protected policy are checked. Import aliases behind re-exports are not resolved. An outer-owned interface is not universally invalid; this enforces declared inner ownership.',
  create(context) {
    const config = architecture(context);
    if (!inCore(config, context.physicalFilename)) return {};
    return { ImportDeclaration(node) {
      if (node.source.type !== 'Literal') return;
      const target = resolveDependency(config, context.physicalFilename, String(node.source.value));
      if (!target || !hasRole(config, target, 'port') || !outside(config, context.physicalFilename, target)) return;
      report(context, node, `Port imported from ${String(node.source.value)} belongs outside this policy boundary`, [11, 22]);
    } };
  },
});
