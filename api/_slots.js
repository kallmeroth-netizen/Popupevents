// Visit windows for the Neighbors Only preview, Brentwood only.
// Guests pick one hour window on a preview day. The preview runs from
// VISIT_START to VISIT_END (inclusive, Brentwood dates; defaults below), and
// only days from today on are offered. Four windows a day, 4 to 9 PM with 6 to
// 7 skipped. Capacity is per window and per day and
// can be tuned in Vercel without a deploy:
//   VISIT_WINDOW_CAP  parties per hour window (default 1)
//   VISIT_DAY_CAP     parties per day (default 4)
//
// HOLDS, so the picker never looks wide open. These are not bookings; the
// backend shows them as "Held" so nobody mistakes them for guests:
//   VISIT_OPEN_DAYS   how many days from today are bookable (default 6, so
//                     today through five days out; the window rolls forward a
//                     day each day). Days after that show every window as Full.
//                     Set 0 to open every preview day.
//   VISIT_HOLDS       off-peak windows held back. Unset: an automatic pattern,
//                     one off-peak window (4 to 5 or 8 to 9 PM) on about two
//                     of every three of the next VISIT_HOLD_DAYS days (default 4).
//                     Or an explicit list "2026-11-06:16,2026-11-08:20".
//                     Set "off" to release them all once bookings fill up.
//   VISIT_OPEN_DATES  days that are bookable no matter the horizon, comma list
//                     (default 2026-11-12,2026-11-13: Thursday and Friday of the second week).
const TZ = 'America/Los_Angeles';
const WINDOWS = [16, 17, 19, 20];
const START = () => (process.env.VISIT_START || '2026-11-04').trim();
const END = () => (process.env.VISIT_END || '2026-11-15').trim();
const LOCATION = 'Brentwood';

const windowCap = () => Math.max(1, parseInt(process.env.VISIT_WINDOW_CAP, 10) || 1);
const openDays = () => { const n = parseInt(process.env.VISIT_OPEN_DAYS, 10); return Number.isNaN(n) ? 6 : Math.max(0, n); };
const holdDays = () => { const n = parseInt(process.env.VISIT_HOLD_DAYS, 10); return Number.isNaN(n) ? 4 : Math.max(0, n); };
const OFF_PEAK = [16, 20];
const hashOf = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000003; return h; };
// Off-peak windows held back on a given date (see the HOLDS note above).
function holdsFor(date, todayDate) {
  const raw = (process.env.VISIT_HOLDS || '').trim();
  if (raw.toLowerCase() === 'off') return [];
  if (raw) return raw.split(',').map((s) => s.trim()).filter((s) => s.startsWith(date + ':')).map((s) => Number(s.split(':')[1])).filter((h) => WINDOWS.includes(h));
  const idx = Math.round((new Date(date + 'T12:00:00Z') - new Date(todayDate + 'T12:00:00Z')) / 86400000);
  if (idx < 0 || idx >= holdDays()) return [];
  const pick = hashOf(date) % 3;
  return pick === 0 ? [] : [OFF_PEAK[pick - 1]];
}
const openDates = () => (process.env.VISIT_OPEN_DATES || '2026-11-12,2026-11-13').split(',').map((s) => s.trim()).filter(Boolean);
const openThrough = (todayDate) => { const n = openDays(); const d = n > 0 ? addDays(todayDate, n - 1) : END(); return d < END() ? d : END(); };
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

// Every preview day still ahead, with each window's status, given every ticket in the store.
// excludeId leaves one ticket's own booking out of the counts (for rebooking).
function availability(tickets, excludeId, now = new Date()) {
  const t = laNow(now);
  const counts = {};
  for (const k of tickets || []) {
    if (!k || !k.visit || k.id === excludeId) continue; // redeemed visits still hold their window
    const c = (counts[k.visit.date] = counts[k.visit.date] || { total: 0 });
    c[k.visit.hour] = (c[k.visit.hour] || 0) + 1;
    c.total++;
  }
  const through = openThrough(t.date);
  const first = t.date > START() ? t.date : START();
  const dates = [];
  for (let d = first; d <= END() && dates.length < 60; d = addDays(d, 1)) dates.push(d);
  return dates.map((date) => {
    const c = counts[date] || { total: 0 };
    const dayFull = c.total >= dayCap();
    const later = date > through && !openDates().includes(date);
    const held = later ? WINDOWS.slice() : holdsFor(date, t.date);
    const windows = WINDOWS.map((hour) => {
      const used = c[hour] || 0;
      const past = date === t.date && t.hour >= hour;
      const left = Math.max(0, windowCap() - used);
      const isHeld = held.includes(hour) && used === 0;
      const open = !past && !dayFull && left > 0 && !isHeld;
      return { hour, label: windowLabel(hour), open, left: open ? left : 0, past, booked: used, held: isHeld };
    });
    return { date, ...labels(date), today: date === t.date, later, open: windows.some((w) => w.open), windows };
  });
}

function visitLabels(visit) {
  if (!visit) return null;
  return { ...visit, label: windowLabel(visit.hour), dateLabel: labels(visit.date).short, longLabel: labels(visit.date).long, time: `${pad(visit.hour)}:00`, location: LOCATION };
}

// Apple Wallet passes need the signing certificates in Vercel (see _wallet.js).
const walletConfigured = () => ['WALLET_CERT_B64', 'WALLET_KEY_B64', 'WALLET_WWDR_B64', 'WALLET_PASS_TYPE_ID', 'WALLET_TEAM_ID'].every((k) => (process.env[k] || '').trim());

// What the guest page gets to see.
function ticketView(t) {
  return { id: t.id, name: t.name, redeemed: t.redeemed, qty: t.qty, redeemedAt: t.redeemedAt, visit: visitLabels(t.visit), plusOne: t.plusOne || '', email: t.email || '', today: laNow().date, wallet: walletConfigured() };
}

module.exports = { TZ, WINDOWS, START, END, LOCATION, openDays, openDates, openThrough, holdsFor, walletConfigured, DATE_RE, laNow, addDays, labels, windowLabel, windowCap, dayCap, availability, visitLabels, ticketView };
