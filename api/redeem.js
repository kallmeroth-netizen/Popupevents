const { getTicket, redeemTicket, json, readBody, safeEqual, ID_RE } = require('./_store');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const body = await readBody(req);
  const id = String(body.id || '').toLowerCase();
  const pin = String(body.pin || '');
  const qty = Math.max(1, Math.min(6, parseInt(body.qty, 10) || 1));
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  if (body.idVerified !== true) return json(res, 400, { error: 'id_not_verified' });
  if (!process.env.BARTENDER_PIN) return json(res, 500, { error: 'pin_not_configured' });

  if (!safeEqual(pin, process.env.BARTENDER_PIN)) {
    await sleep(900); // slow down guessing
    return json(res, 401, { error: 'bad_pin' });
  }
  try {
    const t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    if (t.redeemed) return json(res, 409, { error: 'already_redeemed', qty: t.qty, redeemedAt: t.redeemedAt });
    const after = await redeemTicket(id, qty);
    return json(res, 200, { ok: true, id, qty: after.qty, redeemedAt: after.redeemedAt });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
