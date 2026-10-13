const { getTicket, json, ID_RE } = require('./_store');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    const t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { id: t.id, name: t.name, redeemed: t.redeemed, qty: t.qty, redeemedAt: t.redeemedAt });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
