// Mirrors confirmed visits into the Marketing Hub calendar (Firebase), where
// they show under Influencer. One node per ticket, so a rebook replaces and a
// cleared visit or deleted invite removes. Best effort: a hub hiccup never
// blocks a guest from booking.
//   marketing-calendar/barPreviewVisits/<ticketId>
// Optional env: HUB_FIREBASE_URL (defaults to the hub's database), FIREBASE_DB_SECRET.
// The hub's hourly job pushes Influencer items on to the shared Google Calendar;
// set HUB_SYNC_URL (https://<hub>/api/gcal-sync) and HUB_CRON_SECRET to run it
// right after every booking instead of waiting for the hour.
const { visitLabels, LOCATION } = require('./_slots');

const BASE = (process.env.HUB_FIREBASE_URL || 'https://neighborly-hub-53e4b-default-rtdb.firebaseio.com').replace(/\/+$/, '');
const PATH = 'marketing-calendar/barPreviewVisits';
const auth = () => (process.env.FIREBASE_DB_SECRET ? '?auth=' + encodeURIComponent(process.env.FIREBASE_DB_SECRET) : '');
const nodeUrl = (id) => `${BASE}/${PATH}/${id}.json${auth()}`;

// Shaped like a calendar event so every hub surface (grid, influencer list,
// iCal feed, Google Calendar sync) can read it as one.
function eventFor(t) {
  const v = visitLabels(t.visit);
  const who = t.plusOne ? `${t.name} and ${t.plusOne}` : t.name;
  return {
    id: 'bp_' + t.id,
    name: `Bar Preview: ${who}`,
    start: v.date, end: v.date, time: v.time,
    cat: 'influencer', sub: 'Neighbors Only Preview',
    notes: [t.note ? t.note.trim().replace(/\.$/, '') : '', `${LOCATION}, ${v.label}`, t.plusOne ? `Plus one: ${t.plusOne}` : 'No plus one yet', 'Booked from the drink ticket'].filter(Boolean).join('. ') + '.',
    confirmed: true, hold: false, marketplace: false,
    external: 'exclusivepreview', ticketId: t.id, guest: t.name, plusOne: t.plusOne || '', window: v.label, note: t.note || '',
    updatedAt: Date.now(),
  };
}

async function call(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    return r.ok;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

// Push the ticket's current visit (or its absence) to the hub.
async function syncVisit(t) {
  if (!t || !t.id) return false;
  const ok = t.visit && !t.redeemed
    ? await call(nodeUrl(t.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventFor(t)) })
    : await call(nodeUrl(t.id), { method: 'DELETE' });
  pokeGoogleSync().catch(() => {});
  return ok;
}
const removeVisit = async (id) => { const ok = await call(nodeUrl(id), { method: 'DELETE' }); pokeGoogleSync().catch(() => {}); return ok; };
const removeAll = async () => { const ok = await call(`${BASE}/${PATH}.json${auth()}`, { method: 'DELETE' }); pokeGoogleSync().catch(() => {}); return ok; };

// Ask the hub to push to Google Calendar now. No-op unless HUB_SYNC_URL is set.
async function pokeGoogleSync() {
  const url = (process.env.HUB_SYNC_URL || '').trim();
  if (!url) return false;
  const headers = process.env.HUB_CRON_SECRET ? { Authorization: 'Bearer ' + process.env.HUB_CRON_SECRET } : {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try { const r = await fetch(url, { headers, signal: ctrl.signal }); return r.ok; }
  catch { return false; }
  finally { clearTimeout(timer); }
}

// Rebuild the hub's visit list from the tickets: every booked, unredeemed visit
// is written, and any node the hub still holds for a ticket that no longer has
// one (deleted invite, cleared visit, a write that failed earlier) is removed.
async function reconcile(tickets) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let existing = {};
  try {
    const r = await fetch(`${BASE}/${PATH}.json?shallow=true${auth() ? '&' + auth().slice(1) : ''}`, { signal: ctrl.signal });
    if (!r.ok) return { ok: false, error: 'read ' + r.status };
    existing = (await r.json()) || {};
  } catch { return { ok: false, error: 'unreachable' }; }
  finally { clearTimeout(timer); }
  const keep = new Map((tickets || []).filter((t) => t && t.visit && !t.redeemed).map((t) => [t.id, t]));
  let written = 0, removed = 0, failed = 0;
  for (const t of keep.values()) { (await call(nodeUrl(t.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventFor(t)) })) ? written++ : failed++; }
  for (const key of Object.keys(existing)) { if (!keep.has(key)) { (await call(nodeUrl(key), { method: 'DELETE' })) ? removed++ : failed++; } }
  pokeGoogleSync().catch(() => {});
  return { ok: failed === 0, written, removed, failed };
}

// Can we write? Puts and removes a probe the calendar ignores (no start date).
async function hubWriteStatus() {
  const url = `${BASE}/${PATH}/_probe.json${auth()}`;
  const ok = await call(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ probe: true, at: Date.now() }) });
  if (ok) await call(url, { method: 'DELETE' });
  return ok ? 'ok' : 'error';
}

async function hubStatus() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`${BASE}/${PATH}.json?shallow=true${auth() ? '&' + auth().slice(1) : ''}`, { signal: ctrl.signal });
    return r.ok ? 'ok' : 'error: ' + r.status;
  } catch (e) { return 'unreachable'; }
  finally { clearTimeout(timer); }
}

module.exports = { eventFor, syncVisit, removeVisit, removeAll, reconcile, pokeGoogleSync, hubStatus, hubWriteStatus, PATH };
