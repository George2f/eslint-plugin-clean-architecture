import { RuleTester as RuleTesterClass } from '@typescript-eslint/rule-tester';
import * as parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';

RuleTesterClass.afterAll = afterAll;
RuleTesterClass.describe = describe;
RuleTesterClass.it = it;

export const ruleTester = new RuleTesterClass({
  languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' },
});
