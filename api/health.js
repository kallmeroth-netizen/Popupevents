// GET /api/health -> which pieces are configured. Never reveals values.
const { list } = require('@vercel/blob');
const { json } = require('./_store');
const { hubStatus, hubWriteStatus } = require('./_hub');
const { windowCap, dayCap, openDays, openThrough, laNow } = require('./_slots');
const mail = require('./_mail');
const { delayMin } = require('./_survey');
const { walletConfigured } = require('./_slots');

module.exports = async (req, res) => {
  const out = {
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    bartenderPin: !!process.env.BARTENDER_PIN,
    adminKey: !!process.env.ADMIN_KEY,
    adminPassword: !!process.env.ADMIN_PASSWORD,
    store: 'untested',
    hubCalendar: 'untested',
    confirmationEmail: mail.configured(),
    appleWallet: walletConfigured(),
    googleSyncPoke: !!(process.env.HUB_SYNC_URL || '').trim(),
    survey: { delayMin: delayMin(), template: mail.SURVEY_TEMPLATE() || null, mail: mail.surveyConfigured(), cronSecret: !!(process.env.CRON_SECRET || '').trim() },
    visitCaps: { window: windowCap(), day: dayCap() },
    holds: { openDays: openDays(), openThrough: openThrough(laNow().date), pattern: (process.env.VISIT_HOLDS || 'off').trim() },
  };
  out.hubCalendar = await hubStatus();
  out.hubCalendarWrite = out.hubCalendar === 'ok' ? await hubWriteStatus() : 'skipped';
  if (out.blobToken) {
    try { await list({ prefix: 'tickets/', limit: 1 }); out.store = 'ok'; }
    catch (e) { out.store = 'error: ' + String(e && e.message || e).slice(0, 120); }
  } else {
    out.store = 'no token';
  }
  out.ok = out.blobToken && out.bartenderPin && (out.adminKey || out.adminPassword) && out.store === 'ok';
  return json(res, 200, out);
};
