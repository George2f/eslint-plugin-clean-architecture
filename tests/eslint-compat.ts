import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import { ESLint as ESLintClass, Linter as LinterClass } from 'eslint';

const require = createRequire(import.meta.url);
export const eslintMajor = Number((require('eslint/package.json') as { version: string }).version.split('.')[0]);

export function createLinter(options: { cwd?: string } = {}): Linter {
  return new LinterClass({ ...options, configType: 'flat' } as never);
}

export async function createESLint(options: ConstructorParameters<typeof ESLintClass>[0]): Promise<ESLint> {
  if (eslintMajor >= 9) return new ESLintClass(options);
  const { FlatESLint } = await import('eslint/use-at-your-own-risk');
  return new (FlatESLint as unknown as typeof ESLintClass)(options);
}
