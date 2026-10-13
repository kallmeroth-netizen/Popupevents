// Ticket state lives in Vercel Blob *pathnames*, never in blob bodies, so
// reads are never stale behind the CDN cache. Each ticket is a folder:
//   tickets/<id>/open~<b64url name>~<createdMs>
//   tickets/<id>/redeemed~<qty>~<redeemedMs>
const { put, list } = require('@vercel/blob');

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
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/plain',
  });
}

function parseFolder(id, blobs) {
  const t = { id, name: '', createdAt: null, redeemed: false, qty: 0, redeemedAt: null };
  for (const b of blobs) {
    const leaf = b.pathname.split('/').pop();
    const parts = leaf.split('~');
    if (parts[0] === 'open') {
      t.name = unb64u(parts[1] || '');
      t.createdAt = Number(parts[2]) || null;
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

async function redeemTicket(id, qty) {
  await marker(`tickets/${id}/redeemed~${qty}~${Date.now()}`);
  return getTicket(id);
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

module.exports = { ID_RE, getTicket, createTicket, redeemTicket, allTickets, json, readBody, safeEqual };
