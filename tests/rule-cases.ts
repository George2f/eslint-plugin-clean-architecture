import fs from 'node:fs';
import type { ValidTestCase, InvalidTestCase } from '@typescript-eslint/rule-tester';
import { rules } from '../src/index.js';
import type { Options, Rule } from '../src/types.js';
import { ruleTester } from '../src/test-utils/rule-tester.js';
import { architecture, file } from './architecture.js';

type Valid = ValidTestCase<Options>;
type Invalid = InvalidTestCase<'violation', Options>;
const settings = { 'clean-architecture': architecture };
const source = 'application/source.ts';
const valid = (code: string, filename = source): Valid => ({ code, filename: file(filename), settings });
const invalid = (code: string, filename = source, count = 1): Invalid => ({
  ...valid(code, filename), errors: Array.from({ length: count }, () => ({ messageId: 'violation' as const })),
});
const typed = (name: string): Valid => ({
  code: fs.readFileSync(file(`application/${name}.ts`), 'utf8'), filename: `src/application/${name}.ts`, settings,
  languageOptions: { parserOptions: { project: `${architecture.root}/tsconfig.json`, tsconfigRootDir: architecture.root } },
});
const typedInvalid = (name: string, count = 1): Invalid => ({
  ...typed(name), errors: Array.from({ length: count }, () => ({ messageId: 'violation' as const })),
});

const cases: Record<string, { valid: Valid[]; invalid: Invalid[] }> = {
  'dependency-direction': {
    valid: [valid('import { Order } from "../domain/entity.js";'), valid('import { request } from "./request.js";', 'adapters/source.ts')],
    invalid: [
      invalid('import { Volatile } from "../adapters/volatile.js";'),
      invalid('export * from "@adapters/volatile";'),
      invalid('type X = import("@adapters/volatile").Volatile;'),
      invalid('const x = import(`../adapters/volatile.js`);'),
      invalid('import type { Volatile } from "../adapters/volatile.js";'),
      invalid('import V = require("../adapters/volatile.js");'),
      invalid('export { type Volatile } from "../adapters/volatile.js";'),
    ],
  },
  'component-public-api': {
    valid: [valid('import { Order } from "../domain/index.js";'), valid('import type { Repository } from "./ports.js";')],
    invalid: [invalid('import { Order } from "../domain/entity.js";'), invalid('export * from "../domain/entity.js";')],
  },
  'no-core-infrastructure': {
    valid: [valid('import type { Repository } from "./ports.js";'), valid('import fs from "node:fs";', 'adapters/source.ts')],
    invalid: [invalid('import db from "database-lib";'), invalid('const fs = require("node:fs");'), invalid('import { HttpRequest } from "../adapters/request.js";')],
  },
  'no-composition-root-dependency': {
    valid: [valid('export const main = 1;', 'main.ts'), valid('import { main } from "../main.js";', 'testing/helper.ts')],
    invalid: [invalid('import { main } from "../main.js";')],
  },
  'no-production-test-dependency': {
    valid: [valid('import { helper } from "./helper.js";', 'testing/business.ts'), valid('export const value = 1;')],
    invalid: [invalid('import { helper } from "../testing/helper.js";')],
  },
  'use-case-isolation': {
    valid: [valid('import { DatabaseRepository } from "../adapters/index.js";'), valid('import type { Repository } from "./ports.js";')],
    invalid: [invalid('import { DatabaseRepository } from "../adapters/repository.js";')],
  },
  'no-controller-repository-access': {
    valid: [valid('import { format } from "./presenter.js";', 'ui/controller.ts'), valid('import { DatabaseRepository } from "./repository.js";', 'adapters/source.ts')],
    invalid: [invalid('import { DatabaseRepository } from "../adapters/repository.js";', 'ui/controller.ts')],
  },
  'humble-view-dependencies': {
    valid: [valid('import { format } from "./presenter.js";', 'ui/view.ts')],
    invalid: [invalid('import { Order } from "../domain/entity.js";', 'ui/view.ts')],
  },
  'testing-api-boundaries': {
    valid: [valid('import { loadOrder } from "./api.js";', 'testing/business.ts'), valid('import { helper } from "./helper.js";', 'testing/business.ts')],
    invalid: [invalid('import { Order } from "../domain/entity.js";', 'testing/business.ts'), invalid('import db from "database-lib";', 'testing/business.ts')],
  },
  'no-volatile-concrete-dependency': {
    valid: [valid('import { Stable } from "../adapters/stable.js";')],
    invalid: [invalid('import { Volatile } from "../adapters/volatile.js";')],
  },
  'no-dynamic-boundary-dependencies': {
    valid: [valid('import("../domain/index.js");'), valid('function f(require) { return require(name); }'), valid('import(name);', 'adapters/source.ts')],
    invalid: [invalid('import(name);'), invalid('require(name);')],
  },
  'no-unresolved-boundary-dependencies': {
    valid: [valid('import { Order } from "../domain/index.js";'), valid('import fs from "node:fs";')],
    invalid: [invalid('import { missing } from "./missing.js";')],
  },
  'no-mutation-in-immutable-modules': {
    valid: [valid('export const total = (x) => x + 1;', 'domain/immutable.ts'), valid('const queue = { push() {} }; queue.push();', 'domain/immutable.ts')],
    invalid: [
      invalid('let total = 0; total++;', 'domain/immutable.ts'),
      invalid('const values = []; const alias = values; alias.push(1);', 'domain/immutable.ts'),
      invalid('const values = new Map(); values.set("a", 1);', 'domain/immutable.ts'),
      invalid('const value = {}; delete value.key;', 'domain/immutable.ts'),
    ],
  },
  'no-mutable-module-state': {
    valid: [valid('export const value = 1;', 'domain/immutable.ts'), valid('function f() { let local = 1; return local; }', 'domain/immutable.ts')],
    invalid: [invalid('export let state = 1;', 'domain/immutable.ts')],
  },
  'no-mixed-actor-dependencies': {
    valid: [valid('import { salary } from "../actors/finance/index.js";')],
    invalid: [invalid('import { salary } from "../actors/finance/index.js"; import { hours } from "../actors/hr/index.js";')],
  },
  'no-view-data-formatting': {
    valid: [valid('format(value);', 'ui/view.ts'), valid('value.toFixed(2);', 'ui/presenter.ts')],
    invalid: [invalid('value.toFixed(2);', 'ui/view.ts')],
  },
  'no-volatile-construction': { valid: [typed('construct-good')], invalid: [typedInvalid('construct-bad'), typedInvalid('construct-alias')] },
  'no-volatile-inheritance': { valid: [typed('inherit-good')], invalid: [typedInvalid('inherit-bad')] },
  'no-concrete-method-override': { valid: [typed('override-good')], invalid: [typedInvalid('override-bad')] },
  'port-ownership': { valid: [typed('port-good')], invalid: [typedInvalid('port-bad')] },
  'no-outer-types-in-contracts': { valid: [typed('contracts-good'), typed('contracts-private')], invalid: [typedInvalid('contracts-inferred'), typedInvalid('contracts-constructor')] },
  'no-entity-boundary-data': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-entity')] },
  'boundary-model-dependencies': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-inferred')] },
  'prefer-segregated-interfaces': { valid: [typed('isp-good'), typed('isp-escape')], invalid: [typedInvalid('isp-bad')] },
  'no-subtype-rejection': { valid: [typed('rejection-good')], invalid: [typedInvalid('rejection-bad')] },
  'prefer-polymorphic-dispatch': { valid: [typed('dispatch-good')], invalid: [typedInvalid('dispatch-bad')] },
  'no-behavior-in-boundary-models': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-behavior')] },
};

export function testRule(name: string): void {
  const rule = rules[name], examples = cases[name];
  if (!rule || !examples) throw new Error(`Missing rule specification or cases: ${name}`);
  ruleTester.run(name, rule as unknown as Rule, examples);
}
