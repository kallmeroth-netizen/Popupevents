// GET  /api/survey?id=<ticket>      -> who, the four pages of questions, and their answers so far
// POST /api/survey { id, answers }  -> saves the answers (a second send replaces the first)
const { getTicket, setFeedback, loadFeedback, json, readBody, ID_RE } = require('./_store');
const { visitLabels } = require('./_slots');
const { MENU, STEPS, clean } = require('./_survey');

const view = (t) => ({ id: t.id, name: t.name, first: (t.name || 'neighbor').split(' ')[0], plusOne: t.plusOne || '', redeemed: t.redeemed, visit: visitLabels(t.visit), answered: !!t.feedbackAt, answeredAt: t.feedbackAt || null, answers: t.feedback || null, menu: MENU, steps: STEPS });

module.exports = async (req, res) => {
  const body = req.method === 'POST' ? await readBody(req) : {};
  const id = String((req.query && req.query.id) || body.id || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    const t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    if (req.method !== 'POST') return json(res, 200, view(await loadFeedback(t)));
    const { answers, error, field } = clean(body.answers);
    if (error) return json(res, 400, { error, field });
    const after = await setFeedback(id, answers);
    after.feedback = answers;
    return json(res, 200, { ok: true, ...view(after) });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
