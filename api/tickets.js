const { createTicket, createTickets, allTickets, deleteTicket, deleteAllTickets, json, readBody, safeEqual, ID_RE } = require('./_store');

// The backend accepts the ADMIN_KEY, or ADMIN_PASSWORD if one is set in Vercel.
function authed(req) {
  const key = String(req.headers['x-admin-key'] || '');
  if (!key) return false;
  return [process.env.ADMIN_KEY, process.env.ADMIN_PASSWORD].some((v) => v && safeEqual(key, String(v).trim()));
}

module.exports = async (req, res) => {
  if (!authed(req)) { await new Promise((r) => setTimeout(r, 800)); return json(res, 401, { error: 'unauthorized' }); }
  try {
    if (req.method === 'GET') {
      const tickets = await allTickets();
      return json(res, 200, { tickets });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (Array.isArray(body.names)) {
        const names = body.names.map((n) => String(n || '').trim().slice(0, 40)).filter(Boolean).slice(0, 200);
        if (!names.length) return json(res, 400, { error: 'name_required' });
        return json(res, 200, { tickets: await createTickets(names) });
      }
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
