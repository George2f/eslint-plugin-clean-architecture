import fs from 'node:fs';
import type { ValidTestCase, InvalidTestCase } from '@typescript-eslint/rule-tester';
import { rules } from '../src/index.js';
import type { Options, Rule } from '../src/types.js';
import { ruleTester } from '../src/test-utils/rule-tester.js';
import { architecture, file } from './architecture.js';

type ValidCase = ValidTestCase<Options>;
type InvalidCase = InvalidTestCase<'violation', Options>;
const settings = { 'clean-architecture': architecture };
const source = 'application/source.ts';
const makeValidCase = (code: string, filename = source): ValidCase => ({ code, filename: file(filename), settings });
const makeInvalidCase = (code: string, filename = source, count = 1): InvalidCase => ({
  ...makeValidCase(code, filename), errors: Array.from({ length: count }, () => ({ messageId: 'violation' as const })),
});
const typed = (name: string): ValidCase => ({
  code: fs.readFileSync(file(`application/${name}.ts`), 'utf8'), filename: `src/application/${name}.ts`, settings,
  languageOptions: { parserOptions: { project: `${architecture.root}/tsconfig.json`, tsconfigRootDir: architecture.root } },
});
const typedInvalid = (name: string, count = 1): InvalidCase => ({
  ...typed(name), errors: Array.from({ length: count }, () => ({ messageId: 'violation' as const })),
});

const cases: Record<string, { valid: ValidCase[]; invalid: InvalidCase[] }> = {
  'dependency-direction': {
    valid: [makeValidCase('import { Order } from "../domain/entity.js";'), makeValidCase('import { request } from "./request.js";', 'adapters/source.ts')],
    invalid: [
      makeInvalidCase('import { Volatile } from "../adapters/volatile.js";'),
      makeInvalidCase('export * from "@adapters/volatile";'),
      makeInvalidCase('type X = import("@adapters/volatile").Volatile;'),
      makeInvalidCase('const x = import(`../adapters/volatile.js`);'),
      makeInvalidCase('import type { Volatile } from "../adapters/volatile.js";'),
      makeInvalidCase('import V = require("../adapters/volatile.js");'),
      makeInvalidCase('export { type Volatile } from "../adapters/volatile.js";'),
    ],
  },
  'component-public-api': {
    valid: [makeValidCase('import { Order } from "../domain/index.js";'), makeValidCase('import type { Repository } from "./ports.js";')],
    invalid: [makeInvalidCase('import { Order } from "../domain/entity.js";'), makeInvalidCase('export * from "../domain/entity.js";')],
  },
  'no-core-infrastructure': {
    valid: [makeValidCase('import type { Repository } from "./ports.js";'), makeValidCase('import fs from "node:fs";', 'adapters/source.ts')],
    invalid: [makeInvalidCase('import db from "database-lib";'), makeInvalidCase('const fs = require("node:fs");'), makeInvalidCase('import { HttpRequest } from "../adapters/request.js";')],
  },
  'no-composition-root-dependency': {
    valid: [makeValidCase('export const main = 1;', 'main.ts'), makeValidCase('import { main } from "../main.js";', 'testing/helper.ts')],
    invalid: [makeInvalidCase('import { main } from "../main.js";')],
  },
  'no-production-test-dependency': {
    valid: [makeValidCase('import { helper } from "./helper.js";', 'testing/business.ts'), makeValidCase('export const value = 1;')],
    invalid: [makeInvalidCase('import { helper } from "../testing/helper.js";')],
  },
  'use-case-isolation': {
    valid: [makeValidCase('import { DatabaseRepository } from "../adapters/index.js";'), makeValidCase('import type { Repository } from "./ports.js";')],
    invalid: [makeInvalidCase('import { DatabaseRepository } from "../adapters/repository.js";')],
  },
  'no-controller-repository-access': {
    valid: [makeValidCase('import { format } from "./presenter.js";', 'ui/controller.ts'), makeValidCase('import { DatabaseRepository } from "./repository.js";', 'adapters/source.ts')],
    invalid: [makeInvalidCase('import { DatabaseRepository } from "../adapters/repository.js";', 'ui/controller.ts')],
  },
  'humble-view-dependencies': {
    valid: [makeValidCase('import { format } from "./presenter.js";', 'ui/view.ts')],
    invalid: [makeInvalidCase('import { Order } from "../domain/entity.js";', 'ui/view.ts')],
  },
  'testing-api-boundaries': {
    valid: [makeValidCase('import { loadOrder } from "./api.js";', 'testing/business.ts'), makeValidCase('import { helper } from "./helper.js";', 'testing/business.ts')],
    invalid: [makeInvalidCase('import { Order } from "../domain/entity.js";', 'testing/business.ts'), makeInvalidCase('import db from "database-lib";', 'testing/business.ts')],
  },
  'no-volatile-concrete-dependency': {
    valid: [makeValidCase('import { Stable } from "../adapters/stable.js";')],
    invalid: [makeInvalidCase('import { Volatile } from "../adapters/volatile.js";')],
  },
  'no-dynamic-boundary-dependencies': {
    valid: [makeValidCase('import("../domain/index.js");'), makeValidCase('function f(require) { return require(name); }'), makeValidCase('import(name);', 'adapters/source.ts')],
    invalid: [makeInvalidCase('import(name);'), makeInvalidCase('require(name);')],
  },
  'no-unresolved-boundary-dependencies': {
    valid: [makeValidCase('import { Order } from "../domain/index.js";'), makeValidCase('import fs from "node:fs";')],
    invalid: [makeInvalidCase('import { missing } from "./missing.js";')],
  },
  'no-mutation-in-immutable-modules': {
    valid: [makeValidCase('export const total = (x) => x + 1;', 'domain/immutable.ts'), makeValidCase('const queue = { push() {} }; queue.push();', 'domain/immutable.ts')],
    invalid: [
      makeInvalidCase('let total = 0; total++;', 'domain/immutable.ts'),
      makeInvalidCase('const values = []; const alias = values; alias.push(1);', 'domain/immutable.ts'),
      makeInvalidCase('const values = new Map(); values.set("a", 1);', 'domain/immutable.ts'),
      makeInvalidCase('const value = {}; delete value.key;', 'domain/immutable.ts'),
    ],
  },
  'no-mutable-module-state': {
    valid: [makeValidCase('export const value = 1;', 'domain/immutable.ts'), makeValidCase('function f() { let local = 1; return local; }', 'domain/immutable.ts')],
    invalid: [makeInvalidCase('export let state = 1;', 'domain/immutable.ts')],
  },
  'no-mixed-actor-dependencies': {
    valid: [makeValidCase('import { salary } from "../actors/finance/index.js";')],
    invalid: [makeInvalidCase('import { salary } from "../actors/finance/index.js"; import { hours } from "../actors/hr/index.js";')],
  },
  'no-view-data-formatting': {
    valid: [
      makeValidCase('format(value);', 'ui/view.ts'),
      makeValidCase('value.toFixed(2);', 'ui/view.ts'),
      makeValidCase('value.toFixed(2);', 'ui/view.test.ts'),
      makeValidCase('value.toFixed(2);', 'ui/presenter.ts'),
    ],
    invalid: [makeInvalidCase('export const view = () => value.toFixed(2);', 'ui/view.ts')],
  },
  'no-volatile-construction': { valid: [typed('construct-good')], invalid: [typedInvalid('construct-bad'), typedInvalid('construct-alias')] },
  'no-volatile-inheritance': { valid: [typed('inherit-good')], invalid: [typedInvalid('inherit-bad')] },
  'no-concrete-method-override': { valid: [typed('override-good')], invalid: [typedInvalid('override-bad')] },
  'port-ownership': { valid: [typed('port-good')], invalid: [typedInvalid('port-bad')] },
  'no-outer-types-in-contracts': { valid: [typed('contracts-good'), typed('contracts-private')], invalid: [typedInvalid('contracts-inferred'), typedInvalid('contracts-constructor')] },
  'no-entity-boundary-data': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-entity')] },
  'boundary-model-dependencies': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-inferred')] },
  'prefer-segregated-interfaces': { valid: [typed('isp-good'), typed('isp-escape'), typed('contracts-good')], invalid: [typedInvalid('isp-bad')] },
  'no-subtype-rejection': { valid: [typed('rejection-good')], invalid: [typedInvalid('rejection-bad')] },
  'prefer-polymorphic-dispatch': { valid: [typed('dispatch-good')], invalid: [typedInvalid('dispatch-bad')] },
  'no-behavior-in-boundary-models': { valid: [typed('contracts-good')], invalid: [typedInvalid('contracts-behavior')] },
};

export function testRule(name: string): void {
  const rule = rules[name], examples = cases[name];
  if (!rule || !examples) throw new Error(`Missing rule specification or cases: ${name}`);
  ruleTester.run(name, rule as unknown as Rule, examples);
}
