const { getTicket, markOnce, json, readBody, ID_RE } = require('./_store');
const { ticketView } = require('./_slots');

module.exports = async (req, res) => {
  const body = req.method === 'POST' ? await readBody(req) : {};
  const id = String((req.query && req.query.id) || body.id || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    let t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    // POST { id, here: true } when the guest taps "I'm here"; a plain GET counts as opening the link.
    if (req.method === 'POST') {
      if (body.here === true) t = await markOnce(t, 'here').catch(() => t);
      return json(res, 200, { ok: true });
    }
    await markOnce(t, 'opened').catch(() => {});
    return json(res, 200, ticketView(t));
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
