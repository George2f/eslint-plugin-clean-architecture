import typescript from 'typescript';
import type { TSESTree } from '@typescript-eslint/utils';
import type { Context } from '../types.js';

export function hasTypeServices(context: Context): boolean {
  const services = context.sourceCode.parserServices;
  return Boolean(services?.program && services.esTreeNodeToTSNodeMap);
}

export function typeServices(context: Context) {
  const services = context.sourceCode.parserServices;
  if (!services?.program || !services.esTreeNodeToTSNodeMap || !services.tsNodeToESTreeNodeMap) {
    throw new Error('clean-architecture: this rule requires @typescript-eslint/parser with parserOptions.project or projectService');
  }
  return {
    program: services.program,
    checker: services.program.getTypeChecker(),
    toTS: services.esTreeNodeToTSNodeMap,
    toESTree: services.tsNodeToESTreeNodeMap,
  };
}

export function dealias(checker: typescript.TypeChecker, symbol: typescript.Symbol | undefined): typescript.Symbol | undefined {
  return symbol && symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

export function declarationsOf(context: Context, node: TSESTree.Node): readonly typescript.Declaration[] {
  const { checker, toTS } = typeServices(context);
  const target = toTS.get(node);
  const type = checker.getTypeAtLocation(target);
  const symbols = [dealias(checker, checker.getSymbolAtLocation(target)), type.getSymbol(),
    ...type.getConstructSignatures().map(signature => checker.getReturnTypeOfSignature(signature).getSymbol())];
  return [...new Set(symbols.flatMap(symbol => symbol?.getDeclarations() ?? []))];
}

export function containingClass(start: typescript.Node | undefined): typescript.ClassLikeDeclaration | undefined {
  let current = start;
  while (current) {
    if (typescript.isClassLike(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export function hasModifier(node: typescript.Node, kind: typescript.SyntaxKind): boolean {
  if (!typescript.canHaveModifiers(node)) return false;
  const modifiers = typescript.getModifiers(node);
  return Boolean(modifiers?.some(modifier => modifier.kind === kind));
}

export function walkContractType(context: Context, start: typescript.Type,
  match: (type: typescript.Type, declarations: readonly typescript.Declaration[]) => string | undefined): string | undefined {
  const { checker, program } = typeServices(context);
  const seen = new Set<typescript.Type>();
  const queue = [start];
  const limit = context.options[0]?.maxTypeNodes ?? 2000;
  for (const type of queue) {
    if (seen.has(type)) continue;
    seen.add(type);
    if (seen.size > limit) throw new Error(`clean-architecture: contract traversal exceeded maxTypeNodes=${limit}; increase this rule option or narrow contracts`);
    const declarations = [...(type.aliasSymbol?.declarations ?? []), ...(type.getSymbol()?.declarations ?? [])];
    const result = match(type, declarations);
    if (result) return result;
    if (type.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown | typescript.TypeFlags.StringLike |
      typescript.TypeFlags.NumberLike | typescript.TypeFlags.BigIntLike | typescript.TypeFlags.BooleanLike |
      typescript.TypeFlags.ESSymbolLike | typescript.TypeFlags.Void | typescript.TypeFlags.Undefined | typescript.TypeFlags.Null | typescript.TypeFlags.Never)) continue;
    if (type.isUnionOrIntersection()) queue.push(...type.types);
    queue.push(...(type.aliasTypeArguments ?? []));
    if (type.flags & typescript.TypeFlags.Object && (type as typescript.ObjectType).objectFlags & typescript.ObjectFlags.Reference) {
      queue.push(...checker.getTypeArguments(type as typescript.TypeReference));
    }
    if (type.flags & typescript.TypeFlags.TypeParameter) {
      const constraint = checker.getBaseConstraintOfType(type);
      if (constraint) queue.push(constraint);
    }
    if (declarations.length && declarations.every(declaration =>
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()) ||
      declaration.getSourceFile().fileName.replaceAll('\\', '/').includes('/node_modules/'))) continue;
    for (const kind of [typescript.SignatureKind.Call, typescript.SignatureKind.Construct]) {
      for (const signature of checker.getSignaturesOfType(type, kind)) {
        if (signature.declaration && (hasModifier(signature.declaration, typescript.SyntaxKind.PrivateKeyword) ||
          hasModifier(signature.declaration, typescript.SyntaxKind.ProtectedKeyword))) continue;
        queue.push(checker.getReturnTypeOfSignature(signature));
        for (const parameter of signature.getParameters()) {
          const location = parameter.valueDeclaration ?? parameter.declarations?.[0];
          if (location) queue.push(checker.getTypeOfSymbolAtLocation(parameter, location));
        }
      }
    }
    for (const property of checker.getPropertiesOfType(type)) {
      const location = property.valueDeclaration ?? property.declarations?.[0];
      if (location && !hasModifier(location, typescript.SyntaxKind.PrivateKeyword) && !hasModifier(location, typescript.SyntaxKind.ProtectedKeyword) &&
        !(typescript.isPropertyDeclaration(location) && typescript.isPrivateIdentifier(location.name))) {
        queue.push(checker.getTypeOfSymbolAtLocation(property, location));
      }
    }
    for (const indexInfo of checker.getIndexInfosOfType(type)) queue.push(indexInfo.type);
  }
  return undefined;
}
