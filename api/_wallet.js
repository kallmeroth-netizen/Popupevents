// Apple Wallet pass for a booked visit: a champagne-gold event ticket with the
// guest's name, day and window, a QR code of their ticket link for the bar to
// scan, and the link itself on the back. Signed with the Pass Type ID
// certificate, which must be in Vercel (base64 of the PEM files):
//   WALLET_PASS_TYPE_ID   e.g. pass.com.beneighborly.preview
//   WALLET_TEAM_ID        the Apple Developer team id
//   WALLET_CERT_B64       the Pass Type ID certificate (PEM)
//   WALLET_KEY_B64        its private key (PEM); WALLET_KEY_PASS if it has a passphrase
//   WALLET_WWDR_B64       Apple's WWDR G4 certificate (PEM)
const { PKPass } = require('passkit-generator');
const { visitLabels, walletConfigured, LOCATION } = require('./_slots');
const images = require('./_wallet_assets');

const env = (k) => (process.env[k] || '').trim();
const pem = (k) => Buffer.from(env(k), 'base64');
const SITE = () => env('SITE_URL') || 'https://exclusivepreview.vercel.app';

// Local time in Brentwood as an ISO string with the right offset for that date.
function relevantDate(date, hour) {
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = (() => {
    const la = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' }).formatToParts(probe).find((p) => p.type === 'timeZoneName');
    const m = /GMT([+-]\d+)/.exec(la ? la.value : '');
    return m ? Number(m[1]) : -8;
  })();
  const sign = offset < 0 ? '-' : '+';
  return `${date}T${String(hour).padStart(2, '0')}:00:00${sign}${String(Math.abs(offset)).padStart(2, '0')}:00`;
}

function passJson(t) {
  const v = visitLabels(t.visit);
  const link = `${SITE()}/t/${t.id}`;
  return {
    formatVersion: 1,
    passTypeIdentifier: env('WALLET_PASS_TYPE_ID'),
    teamIdentifier: env('WALLET_TEAM_ID'),
    serialNumber: t.id,
    organizationName: 'Neighborly',
    description: 'Neighbors Only Preview, Neighborly Brentwood',
    logoText: 'Neighbors Only Preview',
    backgroundColor: 'rgb(220, 198, 150)',
    foregroundColor: 'rgb(30, 35, 41)',
    labelColor: 'rgb(110, 86, 48)',
    relevantDate: relevantDate(v.date, v.hour),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: link, messageEncoding: 'iso-8859-1', altText: 'Show this at the bar' }],
    eventTicket: {
      headerFields: [{ key: 'day', label: 'YOUR VISIT', value: v.dateLabel }],
      primaryFields: [{ key: 'window', label: 'HOUR WINDOW', value: v.label }],
      secondaryFields: [
        { key: 'guest', label: 'NEIGHBOR', value: t.name || 'Guest' },
        { key: 'plus', label: 'YOUR GUEST', value: t.plusOne || 'Add one on your ticket', textAlignment: 'PKTextAlignmentRight' },
      ],
      auxiliaryFields: [{ key: 'where', label: 'WHERE', value: `Neighborly ${LOCATION}` }],
      backFields: [
        { key: 'open', label: 'Your ticket', value: link, attributedValue: `<a href="${link}">Open my ticket</a>` },
        { key: 'how', label: 'On the day', value: `Tap I'm here on your ticket when you arrive, then show it at the bar with a valid ID. Your first drink and your meal are on us.` },
        { key: 'change', label: 'Need a different time?', value: 'Open the ticket and tap Change. This pass updates when you add it again.' },
      ],
    },
  };
}

// The signed .pkpass as a buffer. Throws if the certificates are missing or bad.
function buildPass(t) {
  if (!walletConfigured()) throw new Error('wallet_not_configured');
  const buffers = { 'pass.json': Buffer.from(JSON.stringify(passJson(t))) };
  for (const name of Object.keys(images)) buffers[name] = Buffer.from(images[name], 'base64');
  const pass = new PKPass(buffers, { wwdr: pem('WALLET_WWDR_B64'), signerCert: pem('WALLET_CERT_B64'), signerKey: pem('WALLET_KEY_B64'), signerKeyPassphrase: env('WALLET_KEY_PASS') || undefined });
  return pass.getAsBuffer();
}

module.exports = { configured: walletConfigured, buildPass, passJson };
