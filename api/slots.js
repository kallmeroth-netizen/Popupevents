// GET /api/slots?id=<ticket> -> the next seven days of visit windows and what is open.
// Counts only, no names. The ticket's own booking is left out of the counts so
// a guest can move their time without their old window reading as taken.
const { allTickets, getTicket, json, ID_RE } = require('./_store');
const { availability, laNow, windowCap, dayCap, visitLabels, LOCATION } = require('./_slots');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').toLowerCase();
  try {
    const tickets = await allTickets();
    const mine = ID_RE.test(id) ? tickets.find((t) => t.id === id) || null : null;
    const days = availability(tickets, mine ? mine.id : null);
    return json(res, 200, { location: LOCATION, today: laNow().date, caps: { window: windowCap(), day: dayCap() }, days, mine: mine ? visitLabels(mine.visit) : null });
  } catch (e) {
    return json(res, 500, { error: 'store_error' });
  }
};
