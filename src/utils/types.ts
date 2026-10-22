import ts from 'typescript';
import type { TSESTree } from '@typescript-eslint/utils';
import type { Context } from '../types.js';

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

export function dealias(checker: ts.TypeChecker, symbol: ts.Symbol | undefined): ts.Symbol | undefined {
  return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

export function declarationsOf(context: Context, node: TSESTree.Node): readonly ts.Declaration[] {
  const { checker, toTS } = typeServices(context);
  const target = toTS.get(node);
  const type = checker.getTypeAtLocation(target);
  const symbols = [dealias(checker, checker.getSymbolAtLocation(target)), type.getSymbol(),
    ...type.getConstructSignatures().map(signature => checker.getReturnTypeOfSignature(signature).getSymbol())];
  return [...new Set(symbols.flatMap(symbol => symbol?.getDeclarations() ?? []))];
}

export function containingClass(node: ts.Node | undefined): ts.ClassLikeDeclaration | undefined {
  while (node) {
    if (ts.isClassLike(node)) return node;
    node = node.parent;
  }
  return undefined;
}

export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some(modifier => modifier.kind === kind));
}

export function walkContractType(context: Context, start: ts.Type,
  match: (type: ts.Type, declarations: readonly ts.Declaration[]) => string | undefined): string | undefined {
  const { checker, program } = typeServices(context);
  const seen = new Set<ts.Type>();
  const queue = [start];
  const limit = context.options[0]?.maxTypeNodes ?? 2000;
  for (const type of queue) {
    if (seen.has(type)) continue;
    seen.add(type);
    if (seen.size > limit) throw new Error(`clean-architecture: contract traversal exceeded maxTypeNodes=${limit}; increase this rule option or narrow contracts`);
    const declarations = [...(type.aliasSymbol?.declarations ?? []), ...(type.getSymbol()?.declarations ?? [])];
    const result = match(type, declarations);
    if (result) return result;
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.StringLike |
      ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.BooleanLike |
      ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never)) continue;
    if (type.isUnionOrIntersection()) queue.push(...type.types);
    queue.push(...(type.aliasTypeArguments ?? []));
    if (type.flags & ts.TypeFlags.Object && (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      queue.push(...checker.getTypeArguments(type as ts.TypeReference));
    }
    if (type.flags & ts.TypeFlags.TypeParameter) {
      const constraint = checker.getBaseConstraintOfType(type);
      if (constraint) queue.push(constraint);
    }
    if (declarations.length && declarations.every(declaration =>
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()) ||
      declaration.getSourceFile().fileName.replaceAll('\\', '/').includes('/node_modules/'))) continue;
    for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
      for (const signature of checker.getSignaturesOfType(type, kind)) {
        if (signature.declaration && (hasModifier(signature.declaration, ts.SyntaxKind.PrivateKeyword) ||
          hasModifier(signature.declaration, ts.SyntaxKind.ProtectedKeyword))) continue;
        queue.push(checker.getReturnTypeOfSignature(signature));
        for (const parameter of signature.getParameters()) {
          const location = parameter.valueDeclaration ?? parameter.declarations?.[0];
          if (location) queue.push(checker.getTypeOfSymbolAtLocation(parameter, location));
        }
      }
    }
    for (const property of checker.getPropertiesOfType(type)) {
      const location = property.valueDeclaration ?? property.declarations?.[0];
      if (location && !hasModifier(location, ts.SyntaxKind.PrivateKeyword) && !hasModifier(location, ts.SyntaxKind.ProtectedKeyword) &&
        !(ts.isPropertyDeclaration(location) && ts.isPrivateIdentifier(location.name))) {
        queue.push(checker.getTypeOfSymbolAtLocation(property, location));
      }
    }
    for (const info of checker.getIndexInfosOfType(type)) queue.push(info.type);
  }
  return undefined;
}
