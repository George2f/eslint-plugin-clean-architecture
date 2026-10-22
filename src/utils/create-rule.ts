import type { Analysis, Context, Docs, Options, Reliability, Rule } from '../types.js';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { architectureOf, relative, matches, requireScope } from './config.js';

interface Definition {
  name: string;
  description: string;
  chapters: number[];
  principle: string;
  analysis?: Analysis;
  reliability?: Reliability;
  scopes?: Docs['scopes'];
  limitations: string;
  create: (context: Context) => TSESLint.RuleListener;
}

export function createRule(definition: Definition): Rule {
  return {
    meta: {
      type: definition.reliability === 'metric' ? 'suggestion' : 'problem',
      docs: {
        description: definition.description,
        url: `https://github.com/George2f/eslint-plugin-clean-architecture/blob/main/docs/rules.md#${definition.name}`,
        chapters: definition.chapters,
        principle: definition.principle,
        analysis: definition.analysis ?? 'ast',
        reliability: definition.reliability ?? 'configured',
        scopes: definition.scopes ?? [],
        limitations: definition.limitations,
      },
      messages: { violation: '{{detail}} (Clean Architecture {{reference}})' },
      schema: [{
        type: 'object', additionalProperties: false,
        properties: {
          threshold: { type: 'number', minimum: 0, maximum: 1 },
          maxTypeNodes: { type: 'integer', minimum: 10 },
          includeTypeOnly: { type: 'boolean' },
        },
      }],
    },
    defaultOptions: [] as Options,
    create(context) {
      const config = architectureOf(context);
      const filename = context.physicalFilename;
      if (matches(relative(config, filename), config.ignore)) return {};
      for (const key of definition.scopes ?? []) requireScope(config[key], key, definition.name);
      return definition.create(context);
    },
  };
}

export function report(context: Context, node: TSESTree.Node, detail: string, chapters: number[]): void {
  context.report({ node, messageId: 'violation', data: { detail, reference: `Ch. ${chapters.join(', ')}` } });
}
