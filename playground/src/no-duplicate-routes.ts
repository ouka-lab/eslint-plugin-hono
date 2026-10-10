// hono/no-duplicate-routes
// A route (HTTP method + path) must be registered only once, including across basePath() and app.route().
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/no-duplicate-routes.md
import { Hono } from 'hono';
import { logger } from 'hono/logger';

// ❌ no-duplicate-routes: GET / is registered twice, so the second handler never runs
const greeting = new Hono();
greeting.use('*', logger());
greeting.get('/', c => c.text('Hello'));
greeting.get('/', c => c.text('Hello2'));

// ❌ no-duplicate-routes: basePath() clones share one route table, so this is GET /api/book again
const root = new Hono();
const api = root.basePath('/api');
root.get('/api/book', c => c.text('root'));
api.get('/book', c => c.text('api'));

// ❌ no-duplicate-routes: route() mounts book's GET / as GET /book, which the app already answers
const book = new Hono();
book.get('/', c => c.text('List Books'));
const mounted = new Hono();
mounted.get('/book', c => c.text('app'));
mounted.route('/book', book);

// ❌ no-duplicate-routes: all() already answers every method on /hello
const any = new Hono();
any.all('/hello', c => c.text('Any Method'));
any.get('/hello', c => c.text('GET'));

// ✅ ok
const app = new Hono();
app.get('/', c => c.text('get'));
app.post('/', c => c.text('post'));
app.get('/post/:id{[0-9]+}', c => c.text('numeric id'));
app.get('/post/:slug', c => c.text('slug'));
app.route('/greeting', greeting);
app.route('/root', root);
app.route('/mounted', mounted);
app.route('/any', any);

export default app;
