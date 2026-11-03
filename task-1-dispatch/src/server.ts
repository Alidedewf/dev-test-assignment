import { createServer, type ServerResponse } from 'node:http';
import { assignments, loadOf, branches, orders } from './store.ts';
import { almatyDate, assignBranch } from './router.ts';

const port = Number(process.env.PORT ?? 3001);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/branches') {
      return send(res, 200, branches);
    }

    if (req.method === 'GET' && parts[0] === 'orders' && parts.length === 2) {
      const order = orders.find((o) => o.id === parts[1]);
      if (!order) return send(res, 404, { error: 'order_not_found' });
      return send(res, 200, order);
    }

    if (req.method === 'POST' && parts[0] === 'orders' && parts[2] === 'assign' && parts.length === 3) {
      const order = orders.find((o) => o.id === parts[1]);
      if (!order) return send(res, 404, { error: 'order_not_found' });

      const existing = assignments.get(order.id);
      if (existing) return send(res, 200, existing);
      
      const date = almatyDate(order.createdAt);
      const result = assignBranch(order, branches, (b) => loadOf(b.id, date) >= b.dailyLimit);
      assignments.set(order.id, result);
      return send(res, 200, result);
    }

    if (req.method === 'GET' && parts[0] === 'branches' && parts[2] === 'load' && parts.length === 3) {
      const date = url.searchParams.get('date');
      if (!date || !isValidDate(date)) return send(res, 400, { error: 'invalid_date' });

      const branch = branches.find((b) => b.id === parts[1]);
      if (!branch) return send(res, 404, { error: 'branch_not_found' });

      return send(res, 200, {
        branchId: branch.id,
        date,
        assigned: loadOf(branch.id, date),
        limit: branch.dailyLimit,
      });
    }
    send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'internal' });
  }
});

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

server.listen(port, () => {
  console.log(`dispatch: http://localhost:${port}`);
});
