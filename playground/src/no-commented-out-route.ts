// hono/no-commented-out-route
// Delete routes and middleware you no longer want instead of commenting them out.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-commented-out-route.md
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

// ❌ no-commented-out-route: the middleware is silently skipped for every request
// app.use(logger());

// ✅ ok
app.use('/admin/*', logger());

// ✅ ok
// Lists all users.
app.get('/users', c => c.json([]));

// ❌ no-commented-out-route: POST /users now falls through to a 404
// app.post('/users', (c) => {
//   return c.json({ created: true }, 201);
// });

export default app;
