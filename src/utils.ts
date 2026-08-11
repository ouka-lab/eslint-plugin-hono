import { ESLintUtils } from '@typescript-eslint/utils';

export const createRule = ESLintUtils.RuleCreator(
  name =>
    `https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/${name}.md`,
);
