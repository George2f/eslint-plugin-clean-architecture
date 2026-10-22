import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import type { Architecture, Context } from '../types.js';
import { architecture, componentOf, matches, relative, slash } from './config.js';
import { compilerSettings, moduleMode, type LoadKind } from './dependencies.js';

export interface Edge { source: string; target: string; specifier: string; start: number; typeOnly: boolean }
export interface Metric { instability: number; abstractness: number; distance: number; incoming: number; outgoing: number; modules: number }
export interface Graph {
  files: Map<string, ts.SourceFile>;
  edges: Edge[];
  adjacency: Map<string, Set<string>>;
  metrics: Map<string, Metric>;
}

interface Cached { key: string; digest: string; graph: Graph; reads: Map<string, string | undefined>; exists: Map<string, boolean>; directories: Map<string, boolean> }
const cache: Cached[] = [];
const read = (file: string): string | undefined => { try { return fs.readFileSync(file, 'utf8'); } catch { return undefined; } };

function bindingContains(name: ts.BindingName, expected: string): boolean {
  if (ts.isIdentifier(name)) return name.text === expected;
  return name.elements.some(element => ts.isBindingElement(element) && bindingContains(element.name, expected));
}

function requireShadowing(file: ts.SourceFile): (node: ts.Node) => boolean {
  interface Scope { parent?: Scope; function: boolean; bound: boolean }
  const scopes = new Map<ts.Node, Scope>();
  const visit = (node: ts.Node, outer: Scope): void => {
    let scope = outer;
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === 'require') outer.bound = true;
    if (ts.isFunctionLike(node) || ts.isBlock(node) || ts.isCaseBlock(node) || ts.isCatchClause(node) ||
      ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) ||
      ts.isClassLike(node) || ts.isModuleBlock(node)) {
      scope = { parent: outer, function: ts.isFunctionLike(node) || ts.isModuleBlock(node), bound: false };
    }
    if (ts.isFunctionLike(node)) {
      if (node.parameters.some(parameter => bindingContains(parameter.name, 'require'))) scope.bound = true;
      if (ts.isFunctionExpression(node) && node.name?.text === 'require') scope.bound = true;
    }
    if (ts.isClassLike(node) && node.name?.text === 'require') scope.bound = true;
    if (ts.isVariableDeclaration(node) && bindingContains(node.name, 'require')) {
      let owner = scope;
      if (ts.isVariableDeclarationList(node.parent) && !(node.parent.flags & ts.NodeFlags.BlockScoped)) {
        while (!owner.function && owner.parent) owner = owner.parent;
      }
      owner.bound = true;
    }
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.name?.text === 'require' || (clause?.namedBindings &&
        (ts.isNamespaceImport(clause.namedBindings) ? clause.namedBindings.name.text === 'require' :
          clause.namedBindings.elements.some(element => element.name.text === 'require')))) scope.bound = true;
    }
    if (ts.isImportEqualsDeclaration(node) && node.name.text === 'require') scope.bound = true;
    scopes.set(node, scope);
    ts.forEachChild(node, child => visit(child, scope));
  };
  visit(file, { function: true, bound: false });
  return node => {
    let scope = scopes.get(node);
    while (scope) { if (scope.bound) return true; scope = scope.parent; }
    return false;
  };
}

function sourceSpecifiers(file: ts.SourceFile): { specifier: string; start: number; typeOnly: boolean; kind: LoadKind }[] {
  const result: ReturnType<typeof sourceSpecifiers> = [];
  const shadowedRequire = requireShadowing(file);
  const visit = (node: ts.Node): void => {
    let expression: ts.Node | undefined;
    let typeOnly = false;
    let kind: LoadKind = 'static';
    if (ts.isImportDeclaration(node)) {
      expression = node.moduleSpecifier;
      typeOnly = node.importClause?.isTypeOnly ?? false;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings) && bindings.elements.length && !node.importClause?.name) {
        typeOnly ||= bindings.elements.every(element => element.isTypeOnly);
      }
    } else if (ts.isExportDeclaration(node)) {
      expression = node.moduleSpecifier;
      typeOnly = node.isTypeOnly;
      if (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length) {
        typeOnly ||= node.exportClause.elements.every(element => element.isTypeOnly);
      }
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      expression = node.moduleReference.expression;
      typeOnly = node.isTypeOnly;
      kind = 'require';
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      expression = node.argument.literal;
      typeOnly = true;
    } else if (ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require' && !shadowedRequire(node)))) {
      expression = node.arguments[0];
      kind = node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import' : 'require';
    }
    if (expression && (ts.isStringLiteralLike(expression))) {
      result.push({ specifier: expression.text, start: node.getStart(file), typeOnly, kind });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return result;
}

function abstractModule(file: ts.SourceFile): boolean {
  let declarations = 0;
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) { declarations++; continue; }
    if (ts.isClassDeclaration(statement) && statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AbstractKeyword)) { declarations++; continue; }
    if (ts.isFunctionDeclaration(statement) && !statement.body) { declarations++; continue; }
    if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
    return false;
  }
  return declarations > 0;
}

function summarize(config: Architecture, files: Graph['files'], edges: Edge[]): Pick<Graph, 'adjacency' | 'metrics'> {
  const adjacency = new Map((config.components ?? []).map(component => [component.name, new Set<string>()]));
  const groups = new Map<string, { files: ts.SourceFile[]; incoming: Set<string>; outgoing: Set<string> }>();
  for (const file of files.values()) {
    const component = componentOf(config, file.fileName);
    if (!component) continue;
    let group = groups.get(component.name);
    if (!group) { group = { files: [], incoming: new Set(), outgoing: new Set() }; groups.set(component.name, group); }
    group.files.push(file);
  }
  for (const edge of edges) {
    const from = componentOf(config, edge.source), to = componentOf(config, edge.target);
    if (!from || !to || from.name === to.name) continue;
    adjacency.get(from.name)?.add(to.name);
    groups.get(from.name)?.outgoing.add(edge.target);
    groups.get(to.name)?.incoming.add(edge.source);
  }
  const metrics = new Map<string, Metric>();
  for (const [name, group] of groups) {
    const incoming = group.incoming.size, outgoing = group.outgoing.size;
    const instability = incoming + outgoing ? outgoing / (incoming + outgoing) : 0;
    const abstractness = group.files.filter(abstractModule).length / group.files.length;
    metrics.set(name, { incoming, outgoing, instability, abstractness,
      distance: Math.abs(abstractness + instability - 1), modules: group.files.length });
  }
  return { adjacency, metrics };
}

export function projectGraph(context: Context): Graph {
  const config = architecture(context);
  const project = config.project;
  if (!project) throw new Error('clean-architecture: project analysis requires architecture.project');
  const settings = compilerSettings(config);
  const excludes = ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**', ...(config.ignore ?? [])];
  let roots = project.files
    ? ts.sys.readDirectory(config.root, ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'], excludes, project.files)
    : settings.files ?? [];
  roots = roots.map(file => path.resolve(file)).filter(file => !matches(relative(config, file), excludes)).sort();
  if (!roots.length) throw new Error('clean-architecture: project scope contains no source files');
  const key = JSON.stringify([config, settings.options, roots, context.options[0]?.includeTypeOnly !== false]);
  const previous = cache.find(entry => entry.key === key);
  const contents = new Map<string, string>();
  const current = path.resolve(context.physicalFilename);
  for (const file of new Set([...roots, ...(previous?.graph.files.keys() ?? [])])) {
    const text = file === current ? context.sourceCode.text : read(file);
    if (text !== undefined) contents.set(file, text);
  }
  const hash = createHash('sha256');
  for (const [file, text] of [...contents].sort(([a], [b]) => a.localeCompare(b))) hash.update(JSON.stringify([file, text]));
  const digest = hash.digest('hex');
  if (previous?.digest === digest &&
    [...previous.reads].every(([file, text]) => read(file) === text) &&
    [...previous.exists].every(([file, exists]) => ts.sys.fileExists(file) === exists) &&
    [...previous.directories].every(([directory, exists]) => ts.sys.directoryExists(directory) === exists)) return previous.graph;

  const reads = new Map<string, string | undefined>(), exists = new Map<string, boolean>(), directories = new Map<string, boolean>();
  const host: ts.ModuleResolutionHost = {
    readFile(file) { const text = ts.sys.readFile(file); reads.set(file, text); return text; },
    fileExists(file) { const value = ts.sys.fileExists(file); exists.set(file, value); return value; },
    directoryExists(directory) { const value = ts.sys.directoryExists(directory); directories.set(directory, value); return value; },
    realpath: ts.sys.realpath,
    getCurrentDirectory: () => config.root,
  };
  const resolutionCache = ts.createModuleResolutionCache(config.root, value => value, settings.options);
  const files: Graph['files'] = new Map(), edges: Edge[] = [];
  const queue = [...contents.keys()];
  for (const name of queue) {
    if (files.has(name)) continue;
    const text = name === current ? context.sourceCode.text : (contents.get(name) ?? read(name));
    if (text === undefined) continue;
    contents.set(name, text);
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    files.set(name, source);
    for (const item of sourceSpecifiers(source)) {
      if (item.typeOnly && context.options[0]?.includeTypeOnly === false) continue;
      const target = ts.resolveModuleName(item.specifier, name, settings.options, host, resolutionCache, undefined,
        moduleMode(name, settings.options, host, item.kind)).resolvedModule?.resolvedFileName;
      if (!target) continue;
      const absolute = path.resolve(target);
      edges.push({ source: name, target: absolute, ...item });
      if (!relative(config, absolute).startsWith('../') && !slash(absolute).includes('/node_modules/') &&
        !matches(relative(config, absolute), excludes) && !files.has(absolute)) queue.push(absolute);
    }
  }
  const graph = { files, edges, ...summarize(config, files, edges) };
  const finalHash = createHash('sha256');
  for (const [file, text] of [...contents].sort(([a], [b]) => a.localeCompare(b))) finalHash.update(JSON.stringify([file, text]));
  const entry = { key, digest: finalHash.digest('hex'), graph, reads, exists, directories };
  const existing = cache.findIndex(item => item.key === key);
  if (existing >= 0) cache.splice(existing, 1);
  cache.unshift(entry);
  cache.splice(4);
  return graph;
}

export function cyclePath(graph: Graph, from: string, to: string): string[] | undefined {
  const queue: string[][] = [[to]];
  const visited = new Set<string>();
  for (const route of queue) {
    const last = route.at(-1);
    if (!last) continue;
    if (last === from) return [from, ...route];
    if (visited.has(last)) continue;
    visited.add(last);
    for (const next of [...(graph.adjacency.get(last) ?? [])].sort()) queue.push([...route, next]);
  }
  return undefined;
}
