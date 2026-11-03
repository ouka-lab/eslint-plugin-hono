import { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils';

type Options = [];
type MessageIds = 'commentedOutRoute';

/**
 * Matches a line of a comment that starts with a Hono route registration:
 *
 * - `get` / `post` / ... / `all`, `route` and `mount` whose first argument is a
 *   string literal (the path), so `// map.get(key)` is not mistaken for a route;
 * - `on` whose first argument is a method string or an array of them;
 * - `use` with any arguments, so a disabled middleware is caught too.
 *
 * The receiver is optional, so a chained continuation line (`// .get('/x', h)`)
 * matches as well. Anchoring at the start of a line (`m` flag) keeps prose that
 * merely mentions `app.get(` and JSDoc lines (` * app.get(...)`) out.
 */
const COMMENTED_OUT_ROUTE
  = /^\s*[\w$.?]*\.(?:(?:get|post|put|delete|patch|options|all|route|mount)\s*\(\s*['"`]|on\s*\(\s*['"`[]|use\s*\()/mu;

export const noCommentedOutRoute = createRule<Options, MessageIds>({
  name: 'no-commented-out-route',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow commented-out Hono routes.',
    },
    schema: [],
    messages: {
      commentedOutRoute:
        'Remove this commented-out route instead of leaving it in the code.',
    },
  },
  defaultOptions: [],
  create(context) {
    function check(comment: TSESTree.Comment) {
      if (!COMMENTED_OUT_ROUTE.test(comment.value)) {
        return;
      }
      context.report({ node: comment, messageId: 'commentedOutRoute' });
    }

    return {
      Program() {
        context.sourceCode.getAllComments().forEach(check);
      },
    };
  },
});
