import type { ESLint } from 'eslint';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type Role = 'entity' | 'use-case' | 'port' | 'adapter' | 'controller' |
  'repository' | 'view' | 'presenter' | 'composition' | 'test';

export interface Layer {
  name: string;
  files: string[];
  allow: string[];
}

export interface Component {
  name: string;
  files: string[];
  public: string[];
  actor?: string;
  useCase?: string;
}

export interface Architecture {
  root: string;
  layers?: Layer[];
  components?: Component[];
  roles?: Partial<Record<Role, string[]>>;
  core?: string[];
  infrastructure?: Partial<Record<'framework' | 'persistence' | 'transport' | 'platform' | 'hardware', string[]>>;
  volatile?: string[];
  stable?: string[];
  contracts?: string[];
  immutable?: string[];
  tests?: string[];
  testingApi?: string[];
  businessTests?: string[];
  ignore?: string[];
  project?: { tsconfig?: string; files?: string[] };
  unresolved?: 'ignore' | 'report';
}

export interface RuleOptions {
  threshold?: number;
  maxTypeNodes?: number;
  includeTypeOnly?: boolean;
}

export type Options = [RuleOptions?];
export type Context = TSESLint.RuleContext<'violation', Options>;
export type Analysis = 'ast' | 'types' | 'project';
export type Reliability = 'configured' | 'heuristic' | 'metric';

export interface Docs {
  description: string;
  url: string;
  chapters: number[];
  principle: string;
  analysis: Analysis;
  reliability: Reliability;
  scopes: (keyof Architecture)[];
  limitations: string;
}

export type Rule = TSESLint.RuleModule<'violation', Options, Docs> & {
  meta: TSESLint.RuleMetaData<'violation', Docs> & { docs: Docs };
};

export interface Dependency {
  specifier: string;
  target?: string;
  node: TSESTree.Node;
  typeOnly: boolean;
}

export interface FlatConfig {
  name: string;
  plugins: Record<string, ESLint.Plugin>;
  settings?: Record<string, unknown>;
  rules: Record<string, 'error' | 'warn'>;
}
