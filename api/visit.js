// POST /api/visit, from the guest's own ticket page.
//   { id, date, hour }      book or move the visit (capacity checked here)
//   { id, clear: true }     give the window back
//   { id, plusOne: "Sam" }  name the one guest they can bring ("" removes)
//   { id, email }           where to send the confirmation (sent now if a visit is booked)
// Every change is mirrored to the Marketing Hub calendar.
const { getTicket, allTickets, setVisit, clearVisit, setPlusOne, setEmail, json, readBody, ID_RE } = require('./_store');
const { sendConfirmation, EMAIL_RE, configured: mailConfigured } = require('./_mail');
const { availability, WINDOWS, DATE_RE, ticketView } = require('./_slots');
const { syncVisit } = require('./_hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const body = await readBody(req);
  const id = String(body.id || '').toLowerCase();
  if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    const t = await getTicket(id);
    if (!t) return json(res, 404, { error: 'not_found' });
    if (t.redeemed) return json(res, 409, { error: 'already_redeemed' });

    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
      if (email && !EMAIL_RE.test(email)) return json(res, 400, { error: 'bad_email' });
      const after = await setEmail(id, email);
      const mailed = email ? await sendConfirmation(after, false) : false;
      return json(res, 200, { ok: true, mailed, mailConfigured: mailConfigured(), ticket: ticketView(after) });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'plusOne')) {
      const name = String(body.plusOne || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const after = await setPlusOne(id, name);
      syncVisit(after).catch(() => {});
      return json(res, 200, { ok: true, ticket: ticketView(after) });
    }

    if (body.clear === true) {
      const after = t.visit ? await clearVisit(id) : t;
      syncVisit(after).catch(() => {});
      return json(res, 200, { ok: true, ticket: ticketView(after) });
    }

    const date = String(body.date || '');
    const hour = parseInt(body.hour, 10);
    if (!DATE_RE.test(date)) return json(res, 400, { error: 'bad_date' });
    if (!WINDOWS.includes(hour)) return json(res, 400, { error: 'bad_hour' });
    const days = availability(await allTickets(), id);
    const day = days.find((d) => d.date === date);
    if (!day) return json(res, 400, { error: 'bad_date' });
    const w = day.windows.find((x) => x.hour === hour);
    if (!w.open) return json(res, 409, { error: w.past ? 'past' : 'full', days });
    const moved = !!t.visit;
    const after = await setVisit(id, date, hour);
    const synced = await syncVisit(after).catch(() => false);
    const mailed = await sendConfirmation(after, moved).catch(() => false);
    return json(res, 200, { ok: true, synced, mailed, mailConfigured: mailConfigured(), ticket: ticketView(after) });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
