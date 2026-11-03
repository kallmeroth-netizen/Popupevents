// Visit windows for the Neighbors Only preview, Brentwood only.
// Guests pick one hour window on one of the next seven days. Four windows a
// day, 4 to 9 PM with 6 to 7 skipped. Capacity is per window and per day and
// can be tuned in Vercel without a deploy:
//   VISIT_WINDOW_CAP  parties per hour window (default 1)
//   VISIT_DAY_CAP     parties per day (default 4)
const TZ = 'America/Los_Angeles';
const WINDOWS = [16, 17, 19, 20];
const DAYS = 7;
const LOCATION = 'Brentwood';

const windowCap = () => Math.max(1, parseInt(process.env.VISIT_WINDOW_CAP, 10) || 1);
const dayCap = () => Math.max(1, parseInt(process.env.VISIT_DAY_CAP, 10) || 4);

// Clock in Brentwood, whatever region the function runs in.
function laNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
  const g = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')), minute: Number(g('minute')) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function labels(date) {
  const d = new Date(date + 'T12:00:00Z');
  const dow = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const mon = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  return { dow, mon, day, short: `${dow}, ${mon} ${day}`, long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) };
}
const h12 = (h) => (h % 12) || 12;
const windowLabel = (h) => `${h12(h)} to ${h12(h + 1)} PM`;
const pad = (n) => String(n).padStart(2, '0');

// The next seven days with every window's status, given every ticket in the store.
// excludeId leaves one ticket's own booking out of the counts (for rebooking).
function availability(tickets, excludeId, now = new Date()) {
  const t = laNow(now);
  const counts = {};
  for (const k of tickets || []) {
    if (!k || !k.visit || k.id === excludeId || k.redeemed) continue;
    const c = (counts[k.visit.date] = counts[k.visit.date] || { total: 0 });
    c[k.visit.hour] = (c[k.visit.hour] || 0) + 1;
    c.total++;
  }
  return Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(t.date, i);
    const c = counts[date] || { total: 0 };
    const dayFull = c.total >= dayCap();
    const windows = WINDOWS.map((hour) => {
      const used = c[hour] || 0;
      const past = date === t.date && t.hour >= hour;
      const left = Math.max(0, windowCap() - used);
      const open = !past && !dayFull && left > 0;
      return { hour, label: windowLabel(hour), open, left: open ? left : 0, past, booked: used };
    });
    return { date, ...labels(date), today: i === 0, open: windows.some((w) => w.open), windows };
  });
}

function visitLabels(visit) {
  if (!visit) return null;
  return { ...visit, label: windowLabel(visit.hour), dateLabel: labels(visit.date).short, longLabel: labels(visit.date).long, time: `${pad(visit.hour)}:00`, location: LOCATION };
}

// What the guest page gets to see.
function ticketView(t) {
  return { id: t.id, name: t.name, redeemed: t.redeemed, qty: t.qty, redeemedAt: t.redeemedAt, visit: visitLabels(t.visit), plusOne: t.plusOne || '', email: t.email || '', today: laNow().date };
}

module.exports = { TZ, WINDOWS, DAYS, LOCATION, DATE_RE, laNow, addDays, labels, windowLabel, windowCap, dayCap, availability, visitLabels, ticketView };
