import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import { routeGrouping } from './rules/route-grouping';
import { preferHttpException } from './rules/prefer-http-exception';
import { paramNameMismatch } from './rules/param-name-mismatch';
import { noMultipleNext } from './rules/no-multiple-next';
import { noUnusedContextResponse } from './rules/no-unused-context-response';
import { noProcessEnv } from './rules/no-process-env';
import { globalMiddlewarePlacement } from './rules/global-middleware-placement';

const rules = {
  'route-grouping': routeGrouping,
  'prefer-http-exception': preferHttpException,
  'param-name-mismatch': paramNameMismatch,
  'no-multiple-next': noMultipleNext,
  'no-unused-context-response': noUnusedContextResponse,
  'no-process-env': noProcessEnv,
  'global-middleware-placement': globalMiddlewarePlacement,
};

const withPrefix = <R extends Linter.RulesRecord>(rules: R) =>
  Object.keys(rules).reduce((acc, ruleName) => {
    return {
      ...acc,
      [`hono/${ruleName}`]: rules[ruleName],
    };
  }, {}) as {
    [K in keyof R as `hono/${Extract<K, string>}`]: R[K];
  };

/**
 * Rules that catch real bugs and are safe to enable in any Hono project.
 * Stylistic and runtime-specific rules are intentionally left out — see `all`.
 */
const recommendedRules = {
  'param-name-mismatch': 'error',
  'no-multiple-next': 'error',
  'no-unused-context-response': 'error',
  'prefer-http-exception': 'warn',
} as const satisfies Linter.RulesRecord;

const allRules = {
  'route-grouping': 'warn',
  'prefer-http-exception': 'warn',
  'param-name-mismatch': 'error',
  'no-multiple-next': 'error',
  'no-unused-context-response': 'error',
  'no-process-env': 'warn',
  'global-middleware-placement': 'warn',
} as const satisfies Linter.RulesRecord;

const plugin = {
  meta: {
    name: 'eslint-plugin-hono',
    version,
  },
  rules,
  configs: {} as {
    recommended: Linter.Config;
    all: Linter.Config;
  },
};

Object.assign(plugin.configs, {
  recommended: {
    name: 'hono/recommended',
    plugins: {
      get hono(): ESLint.Plugin {
        return plugin as unknown as ESLint.Plugin;
      },
    },
    rules: withPrefix(recommendedRules),
  },
  all: {
    name: 'hono/all',
    plugins: {
      get hono(): ESLint.Plugin {
        return plugin as unknown as ESLint.Plugin;
      },
    },
    rules: withPrefix(allRules),
  },
});

export default plugin;
