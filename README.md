# Neighborly VIP Drink Tickets

Per-guest ticket links, a bartender PIN + quantity flow, and an admin log.

## Deploy (about five minutes)

1. In Vercel, create a new project named `drink-tickets` (Add New > Project, or run `npx vercel` inside this folder and accept the defaults).
2. Storage tab > Create > Blob. Access Private, leave the prefix blank, and tick "Add a read-write token env var to this connection" so `BLOB_READ_WRITE_TOKEN` is created. Connect it to the project.
3. Settings > Environment Variables, add both for Production:
   - `BARTENDER_PIN` = the 4 to 6 digit PIN bartenders type
   - `ADMIN_KEY` = a long random string only you know
   - `ADMIN_PASSWORD` (optional) = the shared Neighborly backend password, so the backend signs in like the other backends
4. Deploy (push, or `npx vercel --prod`).

## Use

- Backend: `https://<your-domain>/admin.html`. Sign in with `ADMIN_PASSWORD` (or the `ADMIN_KEY`). Make one invite or paste a list of names, copy links, and watch each guest go Opened → Here → Redeemed live. Filter, search, export CSV, delete.
- Guest link: `https://<your-domain>/t/<id>`. Guest taps "I'm here", ticket flips to "Show this to the bartender".
- Bartender taps "Bartender: redeem", enters the PIN and the number of drinks. Three seconds later the ticket flips back and the "Redeemed" stamp lands. A ticket can only be redeemed once.
- Every redemption shows in the admin log with guest, drinks, and time.

## Visits (Brentwood)

- When a guest opens their link they pick a day and an hour window first: the next seven days, 4 to 9 PM with 6 to 7 skipped (4 to 5, 5 to 6, 7 to 8, 8 to 9). One party per window and four a day by default; change with `VISIT_WINDOW_CAP` and `VISIT_DAY_CAP` in Vercel, no deploy needed. Windows that have already started close on their own.
- The ticket itself shows the booked time. Guests can move it (Change) or add one plus one by first name; the same link covers both of them.
- Every booking, move, clear and plus one is mirrored to the Marketing Hub calendar at `marketing-calendar/barPreviewVisits/<ticketId>` in Firebase, where it shows under Influencer as a confirmed visit (calendar, influencer list, timeline, iCal feed, Google Calendar sync). Optional env: `HUB_FIREBASE_URL`, `FIREBASE_DB_SECRET`.
- Backend: the "This week in Brentwood" board shows every window with who is in it, each invite shows its visit and plus one, there is a Booked filter, Clear visit frees a window, and the CSV carries both.
- Routes: `GET /api/slots?id=` availability, `POST /api/visit` `{id,date,hour}` book or move, `{id,clear:true}`, `{id,plusOne:"Sam"}`; admin `POST /api/tickets {id, clearVisit:true}`.

## Files

- `index.html` ticket page, `menu.html` cocktail menu (served at `/menu`, linked from the ticket), `admin.html` admin page, `fonts/` the brand fonts (TAYA Maya, Tuppence, Futura Demi), `assets/` wordmarks
- `api/ticket.js` read a ticket (stamps the first open; POST `here` stamps "I'm here"), `api/redeem.js` bartender redemption, `api/tickets.js` admin create (one or many) + list + delete
- `api/_store.js` ticket state kept in Vercel Blob, `api/_slots.js` visit windows and capacity, `api/_hub.js` the Marketing Hub calendar mirror, `api/slots.js` and `api/visit.js` the guest's day and time
