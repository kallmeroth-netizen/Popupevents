const { createTicket, allTickets, deleteTicket, deleteAllTickets, json, readBody, safeEqual, ID_RE } = require('./_store');

function authed(req) {
  const key = req.headers['x-admin-key'] || '';
  return process.env.ADMIN_KEY && safeEqual(key, process.env.ADMIN_KEY);
}

module.exports = async (req, res) => {
  if (!authed(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const tickets = await allTickets();
      return json(res, 200, { tickets });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name || '').trim().slice(0, 40);
      if (!name) return json(res, 400, { error: 'name_required' });
      const t = await createTicket(name);
      return json(res, 200, { ticket: t });
    }
    if (req.method === 'DELETE') {
      const q = req.query || {};
      if (q.all === '1') { const n = await deleteAllTickets(); return json(res, 200, { ok: true, deleted: n }); }
      const id = String(q.id || '').toLowerCase();
      if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
      const n = await deleteTicket(id);
      return json(res, 200, { ok: true, deleted: n });
    }
    return json(res, 405, { error: 'method' });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
