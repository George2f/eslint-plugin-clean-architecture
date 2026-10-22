import fileSystem from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import typescript from 'typescript';
import type { Architecture, Context } from '../types.js';
import { architectureOf, componentOf, matches, relative, slash } from './config.js';
import { compilerSettings, moduleMode, type LoadKind } from './dependencies.js';

export interface Edge { source: string; target: string; specifier: string; start: number; typeOnly: boolean }
export interface Metric { instability: number; abstractness: number; distance: number; incoming: number; outgoing: number; modules: number }
export interface Graph {
  files: Map<string, typescript.SourceFile>;
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
const read = (file: string): string | undefined => { try { return fileSystem.readFileSync(file, 'utf8'); } catch { return undefined; } };

function digestOf(contents: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [file, text] of [...contents].sort(([a], [b]) => a.localeCompare(b))) hash.update(JSON.stringify([file, text]));
  return hash.digest('hex');
}

function rootsFor(config: Architecture, settings: { files?: string[] }, project: NonNullable<Architecture['project']>, excludes: string[]): string[] {
  const roots = project.files
    ? typescript.sys.readDirectory(config.root, ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'], excludes, project.files)
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

function bindingContains(name: typescript.BindingName, expected: string): boolean {
  if (typescript.isIdentifier(name)) return name.text === expected;
  return name.elements.some(element => typescript.isBindingElement(element) && bindingContains(element.name, expected));
}

function requireShadowing(file: typescript.SourceFile): (node: typescript.Node) => boolean {
  interface Scope { parent?: Scope; function: boolean; bound: boolean }
  const scopes = new Map<typescript.Node, Scope>();
  const visit = (node: typescript.Node, outer: Scope): void => {
    let scope = outer;
    if ((typescript.isFunctionDeclaration(node) || typescript.isClassDeclaration(node)) && node.name?.text === 'require') outer.bound = true;
    if (typescript.isFunctionLike(node) || typescript.isBlock(node) || typescript.isCaseBlock(node) || typescript.isCatchClause(node) ||
      typescript.isForStatement(node) || typescript.isForInStatement(node) || typescript.isForOfStatement(node) ||
      typescript.isClassLike(node) || typescript.isModuleBlock(node)) {
      scope = { parent: outer, function: typescript.isFunctionLike(node) || typescript.isModuleBlock(node), bound: false };
    }
    if (typescript.isFunctionLike(node)) {
      if (node.parameters.some(parameter => bindingContains(parameter.name, 'require'))) scope.bound = true;
      if (typescript.isFunctionExpression(node) && node.name?.text === 'require') scope.bound = true;
    }
    if (typescript.isClassLike(node) && node.name?.text === 'require') scope.bound = true;
    if (typescript.isVariableDeclaration(node) && bindingContains(node.name, 'require')) {
      let owner = scope;
      if (typescript.isVariableDeclarationList(node.parent) && !(node.parent.flags & typescript.NodeFlags.BlockScoped)) {
        while (!owner.function && owner.parent) owner = owner.parent;
      }
      owner.bound = true;
    }
    if (typescript.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.name?.text === 'require' || (clause?.namedBindings &&
        (typescript.isNamespaceImport(clause.namedBindings) ? clause.namedBindings.name.text === 'require' :
          clause.namedBindings.elements.some(element => element.name.text === 'require')))) scope.bound = true;
    }
    if (typescript.isImportEqualsDeclaration(node) && node.name.text === 'require') scope.bound = true;
    scopes.set(node, scope);
    typescript.forEachChild(node, child => visit(child, scope));
  };
  visit(file, { function: true, bound: false });
  return node => {
    let scope = scopes.get(node);
    while (scope) { if (scope.bound) return true; scope = scope.parent; }
    return false;
  };
}

function sourceSpecifiers(file: typescript.SourceFile): { specifier: string; start: number; typeOnly: boolean; kind: LoadKind }[] {
  const result: ReturnType<typeof sourceSpecifiers> = [];
  const shadowedRequire = requireShadowing(file);
  const visit = (node: typescript.Node): void => {
    let expression: typescript.Node | undefined;
    let typeOnly = false;
    let kind: LoadKind = 'static';
    if (typescript.isImportDeclaration(node)) {
      expression = node.moduleSpecifier;
      typeOnly = node.importClause?.isTypeOnly ?? false;
      const bindings = node.importClause?.namedBindings;
      if (bindings && typescript.isNamedImports(bindings) && bindings.elements.length && !node.importClause?.name) {
        typeOnly ||= bindings.elements.every(element => element.isTypeOnly);
      }
    } else if (typescript.isExportDeclaration(node)) {
      expression = node.moduleSpecifier;
      typeOnly = node.isTypeOnly;
      if (node.exportClause && typescript.isNamedExports(node.exportClause) && node.exportClause.elements.length) {
        typeOnly ||= node.exportClause.elements.every(element => element.isTypeOnly);
      }
    } else if (typescript.isImportEqualsDeclaration(node) && typescript.isExternalModuleReference(node.moduleReference)) {
      expression = node.moduleReference.expression;
      typeOnly = node.isTypeOnly;
      kind = 'require';
    } else if (typescript.isImportTypeNode(node) && typescript.isLiteralTypeNode(node.argument)) {
      expression = node.argument.literal;
      typeOnly = true;
    } else if (typescript.isCallExpression(node) &&
      (node.expression.kind === typescript.SyntaxKind.ImportKeyword ||
        (typescript.isIdentifier(node.expression) && node.expression.text === 'require' && !shadowedRequire(node)))) {
      expression = node.arguments[0];
      kind = node.expression.kind === typescript.SyntaxKind.ImportKeyword ? 'import' : 'require';
    }
    if (expression && (typescript.isStringLiteralLike(expression))) {
      result.push({ specifier: expression.text, start: node.getStart(file), typeOnly, kind });
    }
    typescript.forEachChild(node, visit);
  };
  visit(file);
  return result;
}

function abstractModule(file: typescript.SourceFile): boolean {
  let declarations = 0;
  for (const statement of file.statements) {
    if (typescript.isImportDeclaration(statement) || typescript.isImportEqualsDeclaration(statement) || typescript.isEmptyStatement(statement)) continue;
    if (typescript.isInterfaceDeclaration(statement) || typescript.isTypeAliasDeclaration(statement)) { declarations++; continue; }
    if (typescript.isClassDeclaration(statement) && statement.modifiers?.some(mod => mod.kind === typescript.SyntaxKind.AbstractKeyword)) { declarations++; continue; }
    if (typescript.isFunctionDeclaration(statement) && !statement.body) { declarations++; continue; }
    if (typescript.isExportDeclaration(statement) && statement.isTypeOnly) continue;
    return false;
  }
  return declarations > 0;
}

function summarize(config: Architecture, files: Graph['files'], edges: Edge[]): Pick<Graph, 'adjacency' | 'metrics'> {
  const adjacency = new Map((config.components ?? []).map(component => [component.name, new Set<string>()]));
  const groups = new Map<string, { files: typescript.SourceFile[]; incoming: Set<string>; outgoing: Set<string> }>();
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
  const config = architectureOf(context);
  const project = config.project;
  if (!project) throw new Error('clean-architecture: project analysis requires architecture.project');
  const settings = compilerSettings(config);
  const includeTypeOnly = context.options[0]?.includeTypeOnly ?? config.includeTypeOnly ?? true;
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
        [...previous.exists].every(([file, exists]) => typescript.sys.fileExists(file) === exists) &&
        [...previous.directories].every(([directory, exists]) => typescript.sys.directoryExists(directory) === exists)) {
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
  const host: typescript.ModuleResolutionHost = {
    readFile(file) { const text = typescript.sys.readFile(file); reads.set(file, text); return text; },
    fileExists(file) { const value = typescript.sys.fileExists(file); exists.set(file, value); return value; },
    directoryExists(directory) { const value = typescript.sys.directoryExists(directory); directories.set(directory, value); return value; },
    realpath: typescript.sys.realpath,
    getCurrentDirectory: () => config.root,
  };
  const resolutionCache = typescript.createModuleResolutionCache(config.root, value => value, settings.options);
  const files: Graph['files'] = new Map(), edges: Edge[] = [];
  const queue = [...contents.keys()];
  for (const name of queue) {
    if (files.has(name)) continue;
    const text = name === current ? context.sourceCode.text : (contents.get(name) ?? read(name));
    if (text === undefined) continue;
    contents.set(name, text);
    const source = typescript.createSourceFile(name, text, typescript.ScriptTarget.Latest, true);
    files.set(name, source);
    for (const item of sourceSpecifiers(source)) {
      if (item.typeOnly && !includeTypeOnly) continue;
      const target = typescript.resolveModuleName(item.specifier, name, settings.options, host, resolutionCache, undefined,
        moduleMode(name, settings.options, host, item.kind)).resolvedModule?.resolvedFileName;
      if (!target) continue;
      const absolute = path.resolve(target);
      edges.push({ source: name, target: absolute, ...item });
      const relativeTarget = relative(config, absolute);
      const externalTarget = relativeTarget.startsWith('../') || slash(absolute).includes('/node_modules/');
      const ignoredTarget = matches(relativeTarget, excludes);
      if (!externalTarget && !ignoredTarget && !files.has(absolute)) queue.push(absolute);
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
