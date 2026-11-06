// Ticket state lives in Vercel Blob *pathnames*, never in blob bodies, so
// reads are never stale behind the CDN cache. Each ticket is a folder:
//   tickets/<id>/open~<b64url name>~<createdMs>
//   tickets/<id>/opened~<firstOpenedMs>      (guest first loaded their link)
//   tickets/<id>/here~<tappedMs>             (guest tapped "I'm here")
//   tickets/<id>/redeemed~<qty>~<redeemedMs>
//   tickets/<id>/visit~<YYYY-MM-DD>~<hour>~<setMs>   (newest wins; date "none" clears)
//   tickets/<id>/plus~<b64url name>~<setMs>         (newest wins; empty name removes)
//   tickets/<id>/email~<b64url address>~<setMs>     (newest wins; for the confirmation email)
//   tickets/<id>/survey~<sentMs>                     (the feedback email went out)
//   tickets/<id>/feedback~<setMs>                    (the guest answered; newest wins)
// The answers themselves are a JSON file, one per submission, never overwritten
// (so no stale cache): feedback/<id>/<setMs>.json
const { put, list, del, get } = require('@vercel/blob');

const ID_RE = /^[a-z0-9]{10,32}$/;

function b64u(s) {
  return Buffer.from(String(s), 'utf8').toString('base64url');
}
function unb64u(s) {
  try { return Buffer.from(String(s), 'base64url').toString('utf8'); } catch { return ''; }
}

function newId() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = require('crypto').randomBytes(14);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function marker(pathname) {
  await put(pathname, '1', {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/plain',
  });
}

function parseFolder(id, blobs) {
  const t = { id, name: '', createdAt: null, openedAt: null, hereAt: null, redeemed: false, qty: 0, redeemedAt: null, visit: null, visitAt: 0, plusOne: '', plusAt: 0, email: '', emailAt: 0, surveySentAt: null, feedback: null, feedbackAt: 0 };
  for (const b of blobs) {
    const leaf = b.pathname.split('/').pop();
    const parts = leaf.split('~');
    if (parts[0] === 'open') {
      t.name = unb64u(parts[1] || '');
      t.createdAt = Number(parts[2]) || null;
    } else if (parts[0] === 'opened' || parts[0] === 'here') {
      const at = Number(parts[1]) || 0;
      const k = parts[0] === 'opened' ? 'openedAt' : 'hereAt';
      if (at && (!t[k] || at < t[k])) t[k] = at;
    } else if (parts[0] === 'visit') {
      const at = Number(parts[3]) || 0;
      if (at >= t.visitAt) { t.visitAt = at; t.visit = parts[1] === 'none' ? null : { date: parts[1], hour: Number(parts[2]) }; }
    } else if (parts[0] === 'plus') {
      const at = Number(parts[2]) || 0;
      if (at >= t.plusAt) { t.plusAt = at; t.plusOne = unb64u(parts[1] || ''); }
    } else if (parts[0] === 'email') {
      const at = Number(parts[2]) || 0;
      if (at >= t.emailAt) { t.emailAt = at; t.email = unb64u(parts[1] || ''); }
    } else if (parts[0] === 'survey') {
      const at = Number(parts[1]) || 0;
      if (at && (!t.surveySentAt || at < t.surveySentAt)) t.surveySentAt = at;
    } else if (parts[0] === 'feedback') {
      const at = Number(parts[1]) || 0;
      if (at >= t.feedbackAt) t.feedbackAt = at;
    } else if (parts[0] === 'redeemed') {
      const at = Number(parts[2]) || 0;
      if (!t.redeemed || at < (t.redeemedAt || Infinity)) {
        t.redeemed = true;
        t.qty = Number(parts[1]) || 1;
        t.redeemedAt = at || null;
      }
    }
  }
  return t;
}

async function listAll(prefix) {
  let cursor; const out = [];
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function getTicket(id) {
  if (!ID_RE.test(id)) return null;
  const blobs = await listAll(`tickets/${id}/`);
  if (!blobs.length) return null;
  return parseFolder(id, blobs);
}

async function createTicket(name) {
  const id = newId();
  await marker(`tickets/${id}/open~${b64u(name)}~${Date.now()}`);
  return getTicket(id);
}

async function createTickets(names) {
  const out = [];
  for (const name of names) out.push(await createTicket(name));
  return out;
}

// First time only: stamps when a guest opened their link or tapped "I'm here".
async function markOnce(t, kind) {
  const k = kind === 'opened' ? 'openedAt' : 'hereAt';
  if (!t || t[k]) return t;
  const at = Date.now();
  await marker(`tickets/${t.id}/${kind}~${at}`);
  return { ...t, [k]: at };
}

// The guest's visit window and plus one. Each write is a fresh marker; the newest wins.
async function setVisit(id, date, hour) {
  await marker(`tickets/${id}/visit~${date}~${hour}~${Date.now()}`);
  return getTicket(id);
}
async function clearVisit(id) {
  await marker(`tickets/${id}/visit~none~0~${Date.now()}`);
  return getTicket(id);
}
async function setEmail(id, email) {
  await marker(`tickets/${id}/email~${b64u(email || '')}~${Date.now()}`);
  return getTicket(id);
}
async function setPlusOne(id, name) {
  await marker(`tickets/${id}/plus~${b64u(name || '')}~${Date.now()}`);
  return getTicket(id);
}

// Feedback: stamps the survey as sent; stores the guest's answers as a file and marks the ticket.
async function markSurveySent(id) {
  await marker(`tickets/${id}/survey~${Date.now()}`);
}
async function setFeedback(id, answers) {
  const at = Date.now();
  await put(`feedback/${id}/${at}.json`, JSON.stringify(answers), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  await marker(`tickets/${id}/feedback~${at}`);
  return getTicket(id);
}
// The newest answers for a ticket (null if none). Fills t.feedback.
async function loadFeedback(t) {
  if (!t || !t.feedbackAt) return t;
  try {
    const r = await get(`feedback/${t.id}/${t.feedbackAt}.json`, { access: 'private', useCache: false });
    if (!r || !r.stream) return t;
    t.feedback = JSON.parse(await new Response(r.stream).text());
  } catch { t.feedback = null; }
  return t;
}
async function loadAllFeedback(tickets) {
  const need = tickets.filter((t) => t.feedbackAt);
  for (let i = 0; i < need.length; i += 8) await Promise.all(need.slice(i, i + 8).map(loadFeedback));
  return tickets;
}

async function redeemTicket(id, qty) {
  await marker(`tickets/${id}/redeemed~${qty}~${Date.now()}`);
  return getTicket(id);
}

async function deleteBlobs(blobs) {
  for (let i = 0; i < blobs.length; i += 100) {
    await del(blobs.slice(i, i + 100).map((b) => b.url));
  }
  return blobs.length;
}

async function deleteTicket(id) {
  if (!ID_RE.test(id)) return 0;
  return deleteBlobs([...(await listAll(`tickets/${id}/`)), ...(await listAll(`feedback/${id}/`))]);
}

async function deleteAllTickets() {
  return deleteBlobs([...(await listAll('tickets/')), ...(await listAll('feedback/'))]);
}

async function allTickets() {
  const blobs = await listAll('tickets/');
  const byId = new Map();
  for (const b of blobs) {
    const id = b.pathname.split('/')[1];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(b);
  }
  const out = [];
  for (const [id, group] of byId) out.push(parseFolder(id, group));
  out.sort((a, b) => (b.redeemedAt || b.createdAt || 0) - (a.redeemedAt || a.createdAt || 0));
  return out;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function safeEqual(a, b) {
  const crypto = require('crypto');
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

module.exports = { ID_RE, getTicket, createTicket, createTickets, markOnce, setVisit, clearVisit, setPlusOne, setEmail, markSurveySent, setFeedback, loadFeedback, loadAllFeedback, redeemTicket, allTickets, deleteTicket, deleteAllTickets, json, readBody, safeEqual };
