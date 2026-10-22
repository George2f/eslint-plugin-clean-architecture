import typescript from 'typescript';
import type { Architecture, Reliability, Rule } from '../types.js';
import { architectureOf, matches, relative } from './config.js';
import { createRule, report } from './create-rule.js';
import { dealias, typeServices, walkContractType } from './types.js';

export interface ContractRuleConfig {
  name: string;
  description: string;
  chapters: number[];
  principle: string;
  scopes: (keyof Architecture)[];
  match: (config: Architecture, source: string, type: typescript.Type, declarations: readonly typescript.Declaration[]) => string | undefined;
  reliability?: Reliability;
  extraLimitations?: string;
}

export function contractRule(config: ContractRuleConfig): Rule {
  const { name, description, chapters, principle, scopes, match } = config;
  const reliability = config.reliability ?? 'configured';
  return createRule({
    name, description, chapters, principle, analysis: 'types', reliability, scopes: ['contracts', ...scopes],
    limitations: 'Checks exported contracts in designated files, including inferred signatures and reachable public types. any/unknown and runtime values cannot reveal hidden concrete types. Standard-library/external internals are not expanded, but their generic arguments are checked. Traversal budget failure is explicit.' + (config.extraLimitations ?? ''),
    create(context) {
      const services = typeServices(context), config = architectureOf(context);
      return { 'Program:exit'(node) {
        if (!matches(relative(config, context.physicalFilename), config.contracts)) return;
        const source = services.toTS.get(node) as typescript.SourceFile;
        const moduleSymbol = services.checker.getSymbolAtLocation(source);
        if (!moduleSymbol) return;
        for (const exported of services.checker.getExportsOfModule(moduleSymbol)) {
          const symbol = dealias(services.checker, exported);
          if (!symbol) continue;
          const location = symbol.valueDeclaration ?? symbol.declarations?.[0];
          if (!location) continue;
          const type = symbol.flags & (typescript.SymbolFlags.Interface | typescript.SymbolFlags.TypeAlias | typescript.SymbolFlags.Class)
            ? services.checker.getDeclaredTypeOfSymbol(symbol)
            : services.checker.getTypeOfSymbolAtLocation(symbol, location);
          const types = [type];
          if (symbol.flags & typescript.SymbolFlags.Class) types.push(services.checker.getTypeOfSymbolAtLocation(symbol, location));
          const detail = types.map(item => walkContractType(context, item,
            (nested, declarations) => match(config, context.physicalFilename, nested, declarations))).find(Boolean);
          if (!detail) continue;
          const local = exported.declarations?.find(declaration => declaration.getSourceFile() === source);
          const mapped = local ? services.toESTree.get(local) : undefined;
          report(context, mapped ?? node, `${exported.name}: ${detail}`, chapters);
        }
      } };
    },
  });
}
