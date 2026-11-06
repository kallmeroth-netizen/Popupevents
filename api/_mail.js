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
  // A body fragment, not a full document: EmailJS drops it inside its own page,
  // and nested html/head/body tags are what make some inboxes render it badly.
  return `<style>
@font-face{font-family:"Tuppence";src:url(${site}/fonts/Tuppence-Variable.otf) format("opentype");font-weight:100 900}
@font-face{font-family:"Futura Neighborly";src:url(${site}/fonts/FuturaCyrillicDemi.ttf) format("truetype");font-weight:600}
@font-face{font-family:"DM Sans";src:url(${site}/fonts/dm-sans-latin-400-normal.woff2) format("woff2");font-weight:400}
</style>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F1E9;">
<tr><td align="center" style="padding:36px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="padding:0 6px 18px;"><img src="${site}/assets/neighborly-wordmark-dark.png" width="150" alt="Neighborly" style="display:block;width:150px;height:auto;border:0;"></td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E6E2DA;border-radius:22px;padding:34px 32px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#6B7280;font-weight:700;padding-bottom:12px;">Neighbors Only Preview</td></tr>
      <tr><td style="font-family:'Tuppence',Georgia,'Times New Roman',serif;font-weight:400;font-size:32px;line-height:1.1;color:#1E2329;padding-bottom:12px;">${e('headline')}</td></tr>
      <tr><td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#3A4049;padding-bottom:24px;">${e('intro')}</td></tr>
      <tr><td style="padding-bottom:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#D4BC88" style="background:#D4BC88;background-image:linear-gradient(135deg,#C9A96E 0%,#E8D7A8 38%,#BD9655 62%,#DCC694 100%);border-radius:18px;">
          <tr><td style="padding:22px 24px 8px;"><img src="${site}/assets/neighborly-wordmark-dark.png" width="104" alt="Neighborly" style="display:block;width:104px;height:auto;border:0;opacity:.85;"></td></tr>
          <tr><td style="padding:14px 24px 0;font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#5E4A24;font-weight:700;">Your visit</td></tr>
          <tr><td style="padding:6px 24px 0;font-family:'Tuppence',Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;color:#1E2329;">${e('visit_day')}</td></tr>
          <tr><td style="padding:4px 24px 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;line-height:1.3;color:#1E2329;">${e('visit_window')}</td></tr>
          <tr><td style="padding:2px 24px 22px;font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5E4A24;">${e('location')}</td></tr>
          <tr><td style="padding:0 24px 20px;font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#5E4A24;border-top:1px dashed rgba(94,74,36,.45);padding-top:14px;">Neighbors only. First drink and meal on the house</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding-bottom:${x.wallet_link ? 12 : 26}px;">
        <a href="${e('ticket_link')}" style="display:inline-block;background:#1E2329;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:16px 34px;font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">Open my ticket</a>
      </td></tr>${x.wallet_link ? `
      <tr><td align="center" style="padding-bottom:26px;">
        <a href="${e('wallet_link')}" style="display:inline-block;background:#FFFFFF;color:#1E2329;text-decoration:none;border:1px solid #1E2329;border-radius:999px;padding:13px 26px;font-family:'Futura Neighborly','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">Add to Apple Wallet</a>
      </td></tr>` : ''}
      <tr><td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3A4049;padding-bottom:12px;">On the day, open your ticket and tap <strong style="color:#1E2329;">I'm here</strong> when you arrive. Show it at the bar with a valid ID and your first drink is on us. Your meal is on the house too.</td></tr>
      <tr><td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3A4049;padding-bottom:12px;">${e('plus_one_line')}</td></tr>
      <tr><td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3A4049;">Need a different time? Open the ticket and tap <strong style="color:#1E2329;">Change</strong>.</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 8px 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.55;color:#A8ADB5;">Must be 21 or older with a valid government-issued ID to redeem. One per guest. No cash value.<br>Neighborly, Brentwood, CA</td></tr>
</table>
</td></tr></table>`;
}
// Same design with EmailJS placeholders, for pasting into the template's code view.
const templateHtml = () => designHtml(Object.fromEntries(['headline', 'intro', 'visit_day', 'visit_window', 'location', 'ticket_link', 'plus_one_line', 'wallet_link'].map((k) => [k, `{{${k}}}`])));

function confirmation(t, moved) {
  const v = visitLabels(t.visit);
  const link = `${SITE()}/t/${t.id}`;
  const walletLink = walletConfigured() ? `${SITE()}/api/wallet?id=${t.id}` : '';
  const first = (t.name || 'neighbor').split(' ')[0];
  const subject = moved ? `Your visit moved: ${v.dateLabel}, ${v.label}` : `You're on the list: ${v.dateLabel}, ${v.label}`;
  const plus = t.plusOne ? `You're bringing ${t.plusOne}. Send them the same link so they're on the list too.` : 'Bringing someone? Your invitation covers one guest. Open your ticket to add them; the same link covers you both.';
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
  const html = designHtml({ wallet_link: walletLink, headline: moved ? 'Your visit moved.' : `You're on the list, ${first}.`, intro: moved ? 'Here is your new time. Your spot is saved.' : 'You’re one of a small group of neighbors invited to try the bar before it opens to anyone else. Your spot is saved.', visit_day: v.longLabel, visit_window: v.label, location: `Neighborly ${LOCATION}`, ticket_link: link, plus_one_line: plus });
  // everything the EmailJS template can use as {{variable}}
  const params = {
    to_email: t.email || '', to_name: t.name || 'Neighbor', first_name: first, guest_name: t.name || '',
    subject, visit_day: v.longLabel, visit_date: v.dateLabel, visit_window: v.label, visit_time: v.time,
    location: `Neighborly ${LOCATION}`, ticket_link: link, wallet_link: walletLink, plus_one: t.plusOne || '', plus_one_line: plus,
    intro: moved ? 'Here is your new time. Your spot is saved.' : 'You’re one of a small group of neighbors invited to try the bar before it opens to anyone else. Your spot is saved.',
    moved: moved ? 'yes' : 'no', headline: moved ? 'Your visit moved.' : `You're on the list, ${first}.`, message: text,
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
  // The whole card is the designed image (assets/email/thank-you-for-visiting.jpg); the
  // image links to the survey, with a text link beneath for inboxes that hide images.
  return `<style>
@font-face{font-family:"Futura Neighborly";src:url(${site}/fonts/FuturaCyrillicDemi.ttf) format("truetype");font-weight:600}
@font-face{font-family:"DM Sans";src:url(${site}/fonts/dm-sans-latin-400-normal.woff2) format("woff2");font-weight:400}
</style>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F1E9;">
<tr><td align="center" style="padding:28px 16px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
  <tr><td style="border-radius:22px;overflow:hidden;">
    <a href="${e('survey_link')}" style="display:block;text-decoration:none;"><img src="${site}/assets/email/thank-you-for-visiting.jpg" width="600" alt="Thank you for visiting. We loved having you at the Neighbors Only preview. Two minutes, neighbor to neighbor: tell us how it was." style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:22px;"></a>
  </td></tr>
  <tr><td align="center" style="padding:22px 8px 0;">
    <a href="${e('survey_link')}" style="${font('Futura Neighborly')}font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#1E2329;text-decoration:underline;text-underline-offset:3px;">Tell us how it was</a>
  </td></tr>
  <tr><td align="center" style="padding:14px 8px 0;${font('DM Sans')}font-size:11px;line-height:1.55;color:#A8ADB5;">One email, no follow-ups.</td></tr>
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
  const subject = `How was it, ${first}?`;
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
