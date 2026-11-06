// GET  /api/survey?id=<ticket>      -> who, the questions, and their answers so far
// POST /api/survey { id, answers }  -> saves the answers (a second send replaces the first)
const { getTicket, setFeedback, json, readBody, ID_RE } = require('./_store');
const { visitLabels } = require('./_slots');
const { COCKTAILS, QUESTIONS, clean, expand } = require('./_survey');

const view = (t) => ({ id: t.id, name: t.name, first: (t.name || 'neighbor').split(' ')[0], plusOne: t.plusOne || '', redeemed: t.redeemed, visit: visitLabels(t.visit), answered: !!t.feedback, answeredAt: t.feedback ? t.feedbackAt : null, answers: expand(t.feedback), cocktails: COCKTAILS, questions: QUESTIONS });

module.exports = async (req, res) => {
  const body = req.method === 'POST' ? await readBody(req) : {};
  const id = String((req.query && req.query.id) || body.id || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    const t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    if (req.method !== 'POST') return json(res, 200, view(t));
    const { answers, error } = clean(body.answers);
    if (error) return json(res, 400, { error });
    const after = await setFeedback(id, answers);
    return json(res, 200, { ok: true, ...view(after) });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
