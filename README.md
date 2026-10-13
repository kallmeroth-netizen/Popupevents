# Neighborly VIP Drink Tickets

Per-guest ticket links, a bartender PIN + quantity flow, and an admin log.

## Deploy (about five minutes)

1. In Vercel, create a new project named `drink-tickets` (Add New > Project, or run `npx vercel` inside this folder and accept the defaults).
2. Storage tab > Create > Blob. Name it `drink-tickets-log`, access Public, and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Settings > Environment Variables, add both for Production:
   - `BARTENDER_PIN` = the 4 to 6 digit PIN bartenders type
   - `ADMIN_KEY` = a long random string only you know
4. Deploy (push, or `npx vercel --prod`).

## Use

- Admin: `https://<your-domain>/admin.html`. Paste the admin key, type a guest's first name, copy their link.
- Guest link: `https://<your-domain>/t/<id>`. Guest taps "I'm here", ticket flips to "Show this to the bartender".
- Bartender taps "Bartender: redeem", enters the PIN and the number of drinks. Three seconds later the ticket flips back and the "Redeemed" stamp lands. A ticket can only be redeemed once.
- Every redemption shows in the admin log with guest, drinks, and time.

## Files

- `index.html` ticket page, `admin.html` admin page, `fonts/` the brand fonts (TAYA Maya, Tuppence, Futura Demi), `assets/` wordmarks
- `api/ticket.js` read a ticket, `api/redeem.js` bartender redemption, `api/tickets.js` admin create + list
- `api/_store.js` ticket state kept in Vercel Blob
