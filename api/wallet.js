// GET /api/wallet?id=<ticket> -> the guest's Apple Wallet pass (.pkpass).
// Only for a booked visit. Opening the link on an iPhone offers Add to Wallet.
const { getTicket, json, ID_RE } = require('./_store');
const { buildPass, configured } = require('./_wallet');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  if (!configured()) return json(res, 503, { error: 'wallet_not_configured' });
  let t;
  try { t = await getTicket(id); } catch { return json(res, 500, { error: 'store_error' }); }
  if (!t) return json(res, 404, { error: 'not_found' });
  if (!t.visit) return json(res, 409, { error: 'no_visit' });
  try {
    const buf = buildPass(t);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="neighborly-preview.pkpass"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  } catch (e) {
    return json(res, 500, { error: 'pass_error', detail: String(e && e.message || e).slice(0, 160) });
  }
};
