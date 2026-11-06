// Visit confirmation email through EmailJS, the same account the Marketing Hub
// uses (service service_v4jp7sp). The template decides the layout; this sends
// the variables. Env (all optional, defaults below): EMAILJS_SERVICE_ID,
// EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, SITE_URL.
// EmailJS refuses server-side sends unless the account allows non-browser
// applications or EMAILJS_PRIVATE_KEY is set, so set the private key.
// Best effort: a mail problem never blocks a booking; the API reports `mailed`.
const { visitLabels, walletConfigured, LOCATION } = require('./_slots');

const env = (k, d) => { const v = (process.env[k] || '').trim(); return v || d; };
const SERVICE = () => env('EMAILJS_SERVICE_ID', 'service_v4jp7sp');
const TEMPLATE = () => env('EMAILJS_TEMPLATE_ID', 'template_lsjzf4n');
// The feedback email needs its own template (body {{{html_body}}}, subject {{subject}}).
// Default is the feedback template in the Neighborly EmailJS account; EMAILJS_SURVEY_TEMPLATE_ID overrides it.
const SURVEY_TEMPLATE = () => env('EMAILJS_SURVEY_TEMPLATE_ID', 'template_njpzl8j');
const surveyConfigured = () => configured() && !!SURVEY_TEMPLATE();
const PUBLIC_KEY = () => env('EMAILJS_PUBLIC_KEY', 'pW4-kj71suA1OsbFa');
const PRIVATE_KEY = () => env('EMAILJS_PRIVATE_KEY', '');
const SITE = () => env('SITE_URL', 'https://exclusivepreview.vercel.app').replace(/\/+$/, '');
const configured = () => !!(SERVICE() && TEMPLATE() && PUBLIC_KEY());
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The email, styled after the pie site's pickup pass: cream page, white card,
// an orange gradient pass with the wordmark, ink button. Tables and inline
// styles so it holds up in Gmail and Apple Mail. `vars` may be real values or
// {{placeholders}} (see templateHtml) for pasting into EmailJS.
function designHtml(x) {
  const site = SITE();
  const e = (k) => esc(x[k]);
  const font = (f) => `font-family:'${f}','Helvetica Neue',Helvetica,Arial,sans-serif;`;
  // The designed card (assets/email/your-ticket-is-ready.jpg) runs full bleed; the white
  // panel beneath carries the visit, the ticket button and the two practical lines.
  // A body fragment, not a full document: EmailJS drops it inside its own page.
  return `<style>
@font-face{font-family:"Futura Neighborly";src:url(${site}/fonts/FuturaCyrillicDemi.ttf) format("truetype");font-weight:600}
@font-face{font-family:"DM Sans";src:url(${site}/fonts/dm-sans-latin-400-normal.woff2) format("woff2");font-weight:400}
</style>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F2F2;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#F2F2F2;">
  <tr><td style="padding:0;line-height:0;">
    <a href="${e('ticket_link')}" style="display:block;text-decoration:none;line-height:0;"><img src="${site}/assets/email/your-ticket-is-ready.jpg" width="600" alt="Your ticket is ready. Open your ticket and tap I'm here when you arrive. Your first drink and your meal are both on us." style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a>
  </td></tr>
  <tr><td align="center" style="padding:30px 28px 0;${font('Futura Neighborly')}font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7280;font-weight:700;">Your visit</td></tr>
  <tr><td align="center" style="padding:8px 28px 0;${font('Futura Neighborly')}font-weight:700;font-size:20px;line-height:1.2;text-transform:uppercase;color:#1E2329;">${e('visit_day')}</td></tr>
  <tr><td align="center" style="padding:4px 28px 0;${font('DM Sans')}font-size:16px;line-height:1.4;color:#1E2329;">${e('visit_window')} &middot; ${e('location')}</td></tr>
  <tr><td align="center" style="padding:6px 28px 0;${font('DM Sans')}font-size:13px;line-height:1.5;color:#6B7280;">${e('intro')}</td></tr>
  <tr><td align="center" style="padding:26px 28px ${x.wallet_link ? 12 : 26}px;">
    <a href="${e('ticket_link')}" style="display:inline-block;background:#E87142;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:17px 40px;${font('Futura Neighborly')}font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;">Open my ticket</a>
  </td></tr>${x.wallet_link ? `
  <tr><td align="center" style="padding:0 28px 26px;">
    <a href="${e('wallet_link')}" style="display:inline-block;background:#FFFFFF;color:#1E2329;text-decoration:none;border:1px solid #1E2329;border-radius:999px;padding:13px 26px;${font('Futura Neighborly')}font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;">Add to Apple Wallet</a>
  </td></tr>` : ''}
  <tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E6E2DA;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
  <tr><td align="center" style="padding:20px 28px 0;${font('DM Sans')}font-size:13.5px;line-height:1.6;color:#3A4049;">${e('plus_one_line')}</td></tr>
  <tr><td align="center" style="padding:10px 28px 28px;${font('DM Sans')}font-size:13.5px;line-height:1.6;color:#3A4049;">Need a different time? Open the ticket and tap Change.</td></tr>
  <tr><td align="center" style="padding:0 28px 30px;${font('DM Sans')}font-size:11px;line-height:1.55;color:#A8ADB5;">Must be 21 or older with a valid government-issued ID to redeem. One per guest. No cash value.</td></tr>
</table>
</td></tr></table>`;
}
// Same design with EmailJS placeholders, for pasting into the template's code view.
const templateHtml = () => designHtml(Object.fromEntries(['intro', 'visit_day', 'visit_window', 'location', 'ticket_link', 'plus_one_line'].map((k) => [k, `{{${k}}}`])));

function confirmation(t, moved) {
  const v = visitLabels(t.visit);
  const link = `${SITE()}/t/${t.id}`;
  const walletLink = walletConfigured() ? `${SITE()}/api/wallet?id=${t.id}` : '';
  const first = (t.name || 'neighbor').split(' ')[0];
  const subject = moved ? `Your visit moved: ${v.dateLabel}, ${v.label}` : `You're on the list: ${v.dateLabel}, ${v.label}`;
  const plus = t.plusOne ? `You're bringing ${t.plusOne}. The same link covers you both.` : 'Bringing someone? Your invitation covers one guest. Add them from your ticket.';
  const text = [
    `Hey ${first},`,
    '',
    moved ? `Your visit to the Neighbors Only bar preview has moved. Your spot is saved.` : `You're one of a small group of neighbors invited to try the bar before it opens to anyone else. Your spot is saved.`,
    `${v.longLabel}, ${v.label}`,
    `Neighborly ${LOCATION}`,
    '',
    `Your ticket: ${link}`,
    ...(walletLink ? [`Add it to Apple Wallet: ${walletLink}`] : []),
    `On the day, open it and tap I'm here when you arrive. Show it at the bar with a valid ID. Your first drink and your meal are on us.`,
    plus,
    'Need a different time? Open the ticket and tap Change.',
    '',
    'See you soon,',
    'Neighborly',
  ].join('\n');
  const html = designHtml({ wallet_link: walletLink, intro: moved ? 'Your visit moved. Your spot is saved.' : 'Your spot is saved.', visit_day: v.longLabel, visit_window: v.label, location: `Neighborly ${LOCATION}`, ticket_link: link, plus_one_line: plus });
  // everything the EmailJS template can use as {{variable}}
  const params = {
    to_email: t.email || '', to_name: t.name || 'Neighbor', first_name: first, guest_name: t.name || '',
    subject, visit_day: v.longLabel, visit_date: v.dateLabel, visit_window: v.label, visit_time: v.time,
    location: `Neighborly ${LOCATION}`, ticket_link: link, wallet_link: walletLink, plus_one: t.plusOne || '', plus_one_line: plus,
    intro: moved ? 'Your visit moved. Your spot is saved.' : 'Your spot is saved.',
    moved: moved ? 'yes' : 'no', headline: moved ? 'Your visit moved.' : 'Your ticket is ready.', message: text,
    html_body: html,
  };
  return { subject, text, html, params };
}

// The feedback ask, a couple of hours after the pour. Same chrome as the
// confirmation, with the orange pass from the ticket.
function surveyHtml(x) {
  const site = SITE();
  const e = (k) => esc(x[k]);
  const font = (f) => `font-family:'${f}','Helvetica Neue',Helvetica,Arial,sans-serif;`;
  // The designed card (assets/email/thank-you-for-visiting.jpg) runs full bleed to the
  // top and sides; the white panel beneath carries the button. Both link to the survey.
  return `<style>
@font-face{font-family:"Futura Neighborly";src:url(${site}/fonts/FuturaCyrillicDemi.ttf) format("truetype");font-weight:600}
@font-face{font-family:"DM Sans";src:url(${site}/fonts/dm-sans-latin-400-normal.woff2) format("woff2");font-weight:400}
</style>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F2F2;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#F2F2F2;">
  <tr><td style="padding:0;line-height:0;">
    <a href="${e('survey_link')}" style="display:block;text-decoration:none;line-height:0;"><img src="${site}/assets/email/thank-you-for-visiting.jpg" width="600" alt="Thank you for visiting. We loved having you at the Neighbors Only preview. Two minutes, neighbor to neighbor." style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a>
  </td></tr>
  <tr><td align="center" style="padding:34px 28px 34px;">
    <a href="${e('survey_link')}" style="display:inline-block;background:#E87142;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:17px 40px;${font('Futura Neighborly')}font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;">Tell us how it was</a>
  </td></tr>
</table>
</td></tr></table>`;
}
const surveyTemplateHtml = () => surveyHtml({ survey_link: '{{survey_link}}' });

function survey(t) {
  const v = visitLabels(t.visit);
  const first = (t.name || 'neighbor').split(' ')[0];
  const link = `${SITE()}/f/${t.id}`;
  const day = v ? v.longLabel : (t.redeemedAt ? new Date(t.redeemedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }) : 'Your visit');
  const headline = 'Thank you for visiting.';
  const intro = 'We loved having you at the Neighbors Only preview. Two minutes. Neighbor to neighbor.';
  const subject = 'We would love to hear your thoughts';
  const text = [`Thank you for visiting, ${first}.`, '', intro, '', `Tell us how it was: ${link}`, '', 'Neighborly'].join('\n');
  const html = surveyHtml({ survey_link: link });
  const params = {
    to_email: t.email || '', to_name: t.name || 'Neighbor', first_name: first, guest_name: t.name || '',
    subject, headline, intro, visit_day: day, visit_date: v ? v.dateLabel : '', visit_window: v ? v.label : '', location: `Neighborly ${LOCATION}`,
    survey_link: link, ticket_link: link, wallet_link: '', plus_one: t.plusOne || '', plus_one_line: 'Two minutes. Neighbor to neighbor.',
    moved: 'no', message: text, html_body: html,
  };
  return { subject, text, html, params, template: SURVEY_TEMPLATE() };
}

async function send(to, msg) {
  if (!configured() || !EMAIL_RE.test(to || '')) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const body = { service_id: SERVICE(), template_id: msg.template || TEMPLATE(), user_id: PUBLIC_KEY(), template_params: { ...msg.params, to_email: to } };
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

// The feedback ask, a couple of hours after the bartender redeemed.
async function sendSurvey(t) {
  if (!t || !t.email || !surveyConfigured()) return false;
  return send(t.email, survey(t));
}

module.exports = { configured, EMAIL_RE, confirmation, designHtml, templateHtml, survey, surveyHtml, surveyTemplateHtml, send, sendConfirmation, sendSurvey, surveyConfigured, SURVEY_TEMPLATE };
