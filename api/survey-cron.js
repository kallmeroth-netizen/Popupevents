// Sends the feedback email to guests whose visit was redeemed SURVEY_DELAY_MIN
// minutes ago (default two hours). Vercel runs it on the schedule in
// vercel.json; the backend also calls it when it opens, so nothing waits on
// the cron if the plan limits it. Each ticket is emailed once.
//   GET  /api/survey-cron                 (Vercel cron; Bearer CRON_SECRET when that env is set)
//   POST /api/survey-cron { id? }         (backend, x-admin-key; with id, sends that ticket's now)
const { allTickets, getTicket, markSurveySent, json, readBody, safeEqual, ID_RE } = require('./_store');
const { due, delayMin } = require('./_survey');
const mail = require('./_mail');

function authed(req) {
  const key = String(req.headers['x-admin-key'] || '');
  if (key && [process.env.ADMIN_KEY, process.env.ADMIN_PASSWORD].some((v) => v && safeEqual(key, String(v).trim()))) return true;
  const secret = (process.env.CRON_SECRET || '').trim();
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (secret) return safeEqual(bearer, secret);
  return req.method === 'GET'; // no secret configured: the schedule can run, writes still need the admin key
}

async function sendOne(t) {
  const sent = await mail.sendSurvey(t);
  if (sent) await markSurveySent(t.id);
  return sent;
}

module.exports = async (req, res) => {
  if (!authed(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const id = String(body.id || '').toLowerCase();
    if (id) {
      if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
      const t = await getTicket(id);
      if (!t) return json(res, 404, { error: 'not_found' });
      if (!t.email) return json(res, 409, { error: 'no_email' });
      if (!mail.surveyConfigured()) return json(res, 503, { error: 'survey_mail_not_configured' });
      const sent = await sendOne(t);
      return json(res, sent ? 200 : 502, { ok: sent, sent: sent ? 1 : 0, mailConfigured: mail.surveyConfigured() });
    }
    if (!mail.surveyConfigured()) return json(res, 200, { ok: true, sent: 0, failed: 0, delayMin: delayMin(), mailConfigured: false, error: 'survey_mail_not_configured' });
    const now = Date.now();
    const tickets = (await allTickets()).filter((t) => due(t, now));
    let sent = 0, failed = 0;
    for (const t of tickets) { (await sendOne(t)) ? sent++ : failed++; }
    return json(res, 200, { ok: failed === 0, sent, failed, delayMin: delayMin(), mailConfigured: true });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
