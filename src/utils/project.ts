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

interface Cached {
  graph: Graph;
  roots: string[];
  digest: string;
  reads: Map<string, string | undefined>;
  exists: Map<string, boolean>;
  directories: Map<string, boolean>;
}
const caches = new WeakMap<Architecture, Map<string, Cached>>();
const settingsIds = new WeakMap<object, number>();
let nextSettingsId = 0;
const read = (file: string): string | undefined => { try { return fs.readFileSync(file, 'utf8'); } catch { return undefined; } };

function digestOf(contents: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [file, text] of [...contents].sort(([a], [b]) => a.localeCompare(b))) hash.update(JSON.stringify([file, text]));
  return hash.digest('hex');
}

function rootsFor(config: Architecture, settings: { files?: string[] }, project: NonNullable<Architecture['project']>, excludes: string[]): string[] {
  const roots = project.files
    ? ts.sys.readDirectory(config.root, ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'], excludes, project.files)
    : settings.files ?? [];
  return roots.map(file => path.resolve(file)).filter(file => !matches(relative(config, file), excludes)).sort();
}

function settingsId(settings: object): number {
  let id = settingsIds.get(settings);
  if (id === undefined) {
    id = nextSettingsId++;
    settingsIds.set(settings, id);
  }
  return id;
}

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
  const includeTypeOnly = context.options[0]?.includeTypeOnly !== false;
  const mode = project.cache ?? 'run';
  const excludes = ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**', ...(config.ignore ?? [])];
  const key = `${settingsId(settings)}|${project.files?.join('|') ?? ''}|${includeTypeOnly}|${mode}|${excludes.join('|')}`;
  let byKey = caches.get(config);
  if (!byKey) {
    byKey = new Map();
    caches.set(config, byKey);
  }
  const previous = byKey.get(key);
  const current = path.resolve(context.physicalFilename);

  if (previous && mode === 'run') {
    const known = previous.graph.files.get(current);
    if (!known || known.text === context.sourceCode.text) return previous.graph;
  }

  const roots = rootsFor(config, settings, project, excludes);
  if (!roots.length) throw new Error('clean-architecture: project scope contains no source files');

  if (previous && mode === 'strict') {
    const unchangedRoots = previous.roots.length === roots.length && previous.roots.every((file, index) => file === roots[index]);
    if (unchangedRoots) {
      const contents = new Map<string, string>();
      let readable = true;
      for (const file of previous.graph.files.keys()) {
        const text = file === current ? context.sourceCode.text : read(file);
        if (text === undefined) { readable = false; break; }
        contents.set(file, text);
      }
      if (readable && digestOf(contents) === previous.digest &&
        [...previous.reads].every(([file, text]) => read(file) === text) &&
        [...previous.exists].every(([file, exists]) => ts.sys.fileExists(file) === exists) &&
        [...previous.directories].every(([directory, exists]) => ts.sys.directoryExists(directory) === exists)) {
        return previous.graph;
      }
    }
  }

  const contents = new Map<string, string>();
  for (const file of roots) {
    const text = file === current ? context.sourceCode.text : read(file);
    if (text !== undefined) contents.set(file, text);
  }
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
      if (item.typeOnly && !includeTypeOnly) continue;
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
  byKey.set(key, { graph, roots, digest: digestOf(contents), reads, exists, directories });
  return graph;
}

const cycleCaches = new WeakMap<Graph, Map<string, string[] | undefined>>();

export function cyclePath(graph: Graph, from: string, to: string): string[] | undefined {
  let cache = cycleCaches.get(graph);
  if (!cache) {
    cache = new Map();
    cycleCaches.set(graph, cache);
  }
  const key = `${from}\0${to}`;
  if (cache.has(key)) return cache.get(key);
  const queue: string[][] = [[to]];
  const visited = new Set<string>();
  let result: string[] | undefined;
  for (const route of queue) {
    const last = route.at(-1);
    if (!last) continue;
    if (last === from) { result = [from, ...route]; break; }
    if (visited.has(last)) continue;
    visited.add(last);
    for (const next of [...(graph.adjacency.get(last) ?? [])].sort()) queue.push([...route, next]);
  }
  cache.set(key, result);
  return result;
}
