// Visit confirmation email through EmailJS, the same account the Marketing Hub
// uses (service service_v4jp7sp). The template decides the layout; this sends
// the variables. Env (all optional, defaults below): EMAILJS_SERVICE_ID,
// EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, SITE_URL.
// EmailJS refuses server-side sends unless the account allows non-browser
// applications or EMAILJS_PRIVATE_KEY is set, so set the private key.
// Best effort: a mail problem never blocks a booking; the API reports `mailed`.
const { visitLabels, LOCATION } = require('./_slots');

const env = (k, d) => { const v = (process.env[k] || '').trim(); return v || d; };
const SERVICE = () => env('EMAILJS_SERVICE_ID', 'service_v4jp7sp');
const TEMPLATE = () => env('EMAILJS_TEMPLATE_ID', 'template_lsjzf4n');
const PUBLIC_KEY = () => env('EMAILJS_PUBLIC_KEY', 'pW4-kj71suA1OsbFa');
const PRIVATE_KEY = () => env('EMAILJS_PRIVATE_KEY', '');
const SITE = () => env('SITE_URL', 'https://exclusivepreview.vercel.app').replace(/\/+$/, '');
const configured = () => !!(SERVICE() && TEMPLATE() && PUBLIC_KEY());
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function confirmation(t, moved) {
  const v = visitLabels(t.visit);
  const link = `${SITE()}/t/${t.id}`;
  const first = (t.name || 'neighbor').split(' ')[0];
  const subject = moved ? `Your visit moved: ${v.dateLabel}, ${v.label}` : `You're in: ${v.dateLabel}, ${v.label}`;
  const plus = t.plusOne ? `You're bringing ${t.plusOne}. Send them the same link so they're on the list.` : 'Bringing someone? Open your ticket and add one guest; the same link covers you both.';
  const text = [
    `Hey ${first},`,
    '',
    moved ? `Your visit to the Neighbors Only bar preview has moved.` : `You're booked for the Neighbors Only bar preview.`,
    `${v.longLabel}, ${v.label}`,
    `Neighborly ${LOCATION}`,
    '',
    `Your ticket: ${link}`,
    `On the day, open it and tap I'm here when you arrive. Show it at the bar with a valid ID and your first drink is on us.`,
    plus,
    'Need a different time? Open the ticket and tap Change.',
    '',
    'See you soon,',
    'Neighborly',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#F5F1E9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1E2329">
<div style="max-width:520px;margin:0 auto;padding:36px 20px">
  <div style="background:#fff;border-radius:22px;padding:34px 30px;border:1px solid #E6E2DA">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7280;font-weight:700">Neighbors Only Preview</div>
    <h1 style="margin:10px 0 6px;font-size:26px;line-height:1.15;font-weight:700">${moved ? 'Your visit moved.' : `You're in, ${esc(first)}.`}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#3A4049">${moved ? 'Here is your new time for the Neighbors Only bar preview.' : 'Your spot at the Neighbors Only bar preview is saved.'}</p>
    <div style="background:#E87242;color:#fff;border-radius:16px;padding:20px 22px;margin:0 0 22px">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;font-weight:700">Your visit</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px;line-height:1.2">${esc(v.longLabel)}</div>
      <div style="font-size:17px;margin-top:4px">${esc(v.label)} · Neighborly ${esc(LOCATION)}</div>
    </div>
    <a href="${esc(link)}" style="display:block;text-align:center;background:#1E2329;color:#fff;text-decoration:none;border-radius:999px;padding:15px 20px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700">Open my ticket</a>
    <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#3A4049">On the day, open your ticket and tap <strong>I'm here</strong> when you arrive. Show it at the bar with a valid ID and your first drink is on us.</p>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#3A4049">${esc(plus)}</p>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#3A4049">Need a different time? Open the ticket and tap Change.</p>
  </div>
  <p style="margin:18px 8px 0;font-size:11px;line-height:1.5;color:#A8ADB5">Must be 21 or older with a valid government-issued ID to redeem. One per guest. No cash value. Neighborly, ${esc(LOCATION)}, CA.</p>
</div></body></html>`;
  // everything the EmailJS template can use as {{variable}}
  const params = {
    to_email: t.email || '', to_name: t.name || 'Neighbor', first_name: first, guest_name: t.name || '',
    subject, visit_day: v.longLabel, visit_date: v.dateLabel, visit_window: v.label, visit_time: v.time,
    location: `Neighborly ${LOCATION}`, ticket_link: link, plus_one: t.plusOne || '', plus_one_line: plus,
    moved: moved ? 'yes' : 'no', headline: moved ? 'Your visit moved.' : `You're in, ${first}.`, message: text,
  };
  return { subject, text, html, params };
}

async function send(to, msg) {
  if (!configured() || !EMAIL_RE.test(to || '')) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const body = { service_id: SERVICE(), template_id: TEMPLATE(), user_id: PUBLIC_KEY(), template_params: { ...msg.params, to_email: to } };
    if (PRIVATE_KEY()) body.accessToken = PRIVATE_KEY();
    const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    return r.ok;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

// Sends the confirmation for the ticket's current visit, if we have an address.
async function sendConfirmation(t, moved) {
  if (!t || !t.visit || !t.email) return false;
  return send(t.email, confirmation(t, moved));
}

module.exports = { configured, EMAIL_RE, confirmation, send, sendConfirmation };
