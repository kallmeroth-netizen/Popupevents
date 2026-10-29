// GET /api/health -> which pieces are configured. Never reveals values.
const { list } = require('@vercel/blob');
const { json } = require('./_store');

module.exports = async (req, res) => {
  const out = {
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    bartenderPin: !!process.env.BARTENDER_PIN,
    adminKey: !!process.env.ADMIN_KEY,
    adminPassword: !!process.env.ADMIN_PASSWORD,
    store: 'untested',
  };
  if (out.blobToken) {
    try { await list({ prefix: 'tickets/', limit: 1 }); out.store = 'ok'; }
    catch (e) { out.store = 'error: ' + String(e && e.message || e).slice(0, 120); }
  } else {
    out.store = 'no token';
  }
  out.ok = out.blobToken && out.bartenderPin && (out.adminKey || out.adminPassword) && out.store === 'ok';
  return json(res, 200, out);
};
