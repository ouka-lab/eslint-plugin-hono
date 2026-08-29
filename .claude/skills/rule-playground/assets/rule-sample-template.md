Template for `playground/src/<rule-name>.ts`.

Copy the code block, fill the placeholders, and delete this file's prose. Every
intentional violation must sit directly under a `// ❌ <rule-name>: …` marker,
and every marker must still trigger the rule — `audit-playground.mjs` checks
both directions.

```typescript
// hono/{{RULE_NAME}}
// {{ONE_LINE_DESCRIPTION}}
// docs: {{META_DOCS_URL}}
import { Hono } from 'hono';

const app = new Hono();

// ❌ {{RULE_NAME}}: {{WHY_THIS_IS_A_VIOLATION}}
{{INCORRECT_CODE}}

// ✅ ok
{{CORRECT_CODE}}

export default app;
```

Rules:

- The `// ❌` marker owns the lines below it up to the next blank line or the
  next marker. Keep a violation and its marker in one unbroken block.
- A file may hold several `// ❌` blocks when the rule has distinct failure
  modes (see `route-grouping`), but each block must produce at least one
  violation of *this* file's rule.
- The `// ✅` half must be completely clean. Any violation reported outside a
  marker block fails the audit.
- Samples must type-check. `npm run typecheck` in `playground/` reports zero
  errors — these are lint problems, not type problems.
