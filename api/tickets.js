const { createTicket, createTickets, allTickets, loadAllFeedback, getTicket, clearVisit, setNote, redeemTicket, deleteTicket, deleteAllTickets, json, readBody, safeEqual, ID_RE } = require('./_store');
const { visitLabels } = require('./_slots');
const { syncVisit, removeVisit, removeAll, reconcile } = require('./_hub');

const withLabels = (t) => ({ ...t, visit: visitLabels(t.visit) });

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
      const tickets = await loadAllFeedback(await allTickets());
      return json(res, 200, { tickets: tickets.map(withLabels) });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      // Rebuild the hub calendar from the invite list: { resync: true }
      if (body.resync === true) {
        const result = await reconcile(await allTickets());
        return json(res, result.ok ? 200 : 502, result);
      }
      // Host marks a guest redeemed without the bartender PIN: { id, redeem: true }. The time is when
      // they checked in (or booked), so the feedback email follows on the usual schedule.
      if (body.redeem === true) {
        const id = String(body.id || '').toLowerCase();
        if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
        const t = await getTicket(id);
        if (!t) return json(res, 404, { error: 'not_found' });
        if (t.redeemed) return json(res, 200, { ticket: withLabels(t), already: true });
        const after = await redeemTicket(id, 1, t.hereAt || Date.now());
        syncVisit(after).catch(() => {});
        return json(res, 200, { ticket: withLabels(after) });
      }
      // Everyone who checked in but was never redeemed counts as attended: { redeemCheckedIn: true }
      if (body.redeemCheckedIn === true) {
        const all = await allTickets();
        const due = all.filter((t) => t.hereAt && !t.redeemed);
        const done = [];
        for (const t of due) { const after = await redeemTicket(t.id, 1, t.hereAt); syncVisit(after).catch(() => {}); done.push(withLabels(after)); }
        return json(res, 200, { ok: true, redeemed: done.length, tickets: done });
      }
      // Host's note on a guest: { id, note } (empty clears). Carried to the hub calendar with the visit.
      if (Object.prototype.hasOwnProperty.call(body, 'note')) {
        const id = String(body.id || '').toLowerCase();
        if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
        const t = await getTicket(id);
        if (!t) return json(res, 404, { error: 'not_found' });
        const after = await setNote(id, String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 300));
        const synced = after.visit && !after.redeemed ? await syncVisit(after).catch(() => false) : false;
        return json(res, 200, { ticket: withLabels(after), synced });
      }
      // Host frees a window: { id, clearVisit: true }
      if (body.clearVisit === true) {
        const id = String(body.id || '').toLowerCase();
        if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
        const t = await getTicket(id);
        if (!t) return json(res, 404, { error: 'not_found' });
        const after = t.visit ? await clearVisit(id) : t;
        syncVisit(after).catch(() => {});
        return json(res, 200, { ticket: withLabels(after) });
      }
      if (Array.isArray(body.names)) {
        const names = body.names.map((n) => String(n || '').trim().slice(0, 40)).filter(Boolean).slice(0, 200);
        if (!names.length) return json(res, 400, { error: 'name_required' });
        return json(res, 200, { tickets: (await createTickets(names)).map(withLabels) });
      }
      const name = String(body.name || '').trim().slice(0, 40);
      if (!name) return json(res, 400, { error: 'name_required' });
      const t = await createTicket(name);
      return json(res, 200, { ticket: withLabels(t) });
    }
    if (req.method === 'DELETE') {
      const q = req.query || {};
      if (q.all === '1') { const n = await deleteAllTickets(); removeAll().catch(() => {}); return json(res, 200, { ok: true, deleted: n }); }
      const id = String(q.id || '').toLowerCase();
      if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
      const n = await deleteTicket(id);
      removeVisit(id).catch(() => {});
      return json(res, 200, { ok: true, deleted: n });
    }
    return json(res, 405, { error: 'method' });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
