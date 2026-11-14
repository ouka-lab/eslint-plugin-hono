// hono/max-return
// Limit the number of `return` statements in a single route handler (default: 5).
// docs: https://github.com/ouka-lab/eslint-plugin-hono/blob/master/docs/rules/max-return.md
import { Hono } from 'hono';
import type { Context } from 'hono';

const app = new Hono();

// ❌ max-return: six exit paths in one inline handler are hard to follow and test
app.get('/orders/:id', (c) => {
  const status = c.req.query('status');
  if (!status) return c.json({ error: 'status is required' }, 400);
  if (status === 'pending') return c.json({ label: 'Pending' });
  if (status === 'paid') return c.json({ label: 'Paid' });
  if (status === 'shipped') return c.json({ label: 'Shipped' });
  if (status === 'cancelled') return c.json({ label: 'Cancelled' });
  return c.json({ error: 'unknown status' }, 400);
});

// ❌ max-return: a handler passed by name is checked the same way
function getShipment(c: Context) {
  const carrier = c.req.query('carrier');
  if (!carrier) return c.json({ error: 'carrier is required' }, 400);
  if (carrier === 'dhl') return c.json({ eta: 2 });
  if (carrier === 'fedex') return c.json({ eta: 3 });
  if (carrier === 'ups') return c.json({ eta: 3 });
  if (carrier === 'usps') return c.json({ eta: 5 });
  return c.json({ error: 'unknown carrier' }, 400);
}
app.get('/shipments/:id', getShipment);

// ✅ ok
const LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

app.get('/invoices/:id', (c) => {
  const status = c.req.query('status');
  if (!status) return c.json({ error: 'status is required' }, 400);
  const label = LABELS[status];
  if (!label) return c.json({ error: 'unknown status' }, 400);
  return c.json({ label });
});

export default app;
