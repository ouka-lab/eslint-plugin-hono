// hono/route-grouping
// Keeps routes for the same path — and for the same Hono instance — next to each other.
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/route-grouping.md
import { Hono } from 'hono';

// ❌ route-grouping: /path1 is registered twice with /path2 wedged in between
const ungrouped = new Hono();
ungrouped.get('/path1', c => c.text('get'));
ungrouped.get('/path2', c => c.text('get'));
ungrouped.post('/path1', c => c.text('post'));

// ❌ route-grouping: post comes before get on the same path
const misordered = new Hono();
misordered.post('/path', c => c.text('post'));
misordered.get('/path', c => c.text('get'));

// ❌ route-grouping: two instances interleaved instead of one block each
const books = new Hono();
const users = new Hono();
books.get('/books', c => c.text('get books'));
users.get('/users', c => c.text('get users'));
books.post('/books', c => c.text('create book'));

// ✅ ok
const app = new Hono();
app.get('/path', c => c.text('get'));
app.post('/path', c => c.text('post'));
app.get('/other', c => c.text('other'));

export default app;
