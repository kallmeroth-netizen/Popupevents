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

- When a guest opens their link they pick a day and an hour window first: any preview day still ahead (`VISIT_START` to `VISIT_END`, default Nov 4 to Nov 15, 2026), 4 to 9 PM with 6 to 7 skipped (4 to 5, 5 to 6, 7 to 8, 8 to 9). One party per window and four a day by default; change with `VISIT_WINDOW_CAP` and `VISIT_DAY_CAP` in Vercel, no deploy needed. Windows that have already started close on their own.
- The ticket itself shows the booked time. Guests can move it (Change) or add one plus one by first name; the same link covers both of them.
- Every booking, move, clear and plus one is mirrored to the Marketing Hub calendar at `marketing-calendar/barPreviewVisits/<ticketId>` in Firebase, where it shows under Influencer as a confirmed visit (calendar, influencer list, timeline, iCal feed, Google Calendar sync). The hub's hourly job then pushes them to the shared Google Calendar; set `HUB_SYNC_URL` (`https://<hub domain>/api/gcal-sync`) and `HUB_CRON_SECRET` (the hub's `CRON_SECRET`) so that push runs right after each booking instead. Optional env: `HUB_FIREBASE_URL`, `FIREBASE_DB_SECRET`.
- Confirmation email: the reservation sheet asks for an email (required), and a confirmation goes out through EmailJS (the hub's account, service `service_v4jp7sp`, template `template_lsjzf4n`); moving the time sends another. Set `EMAILJS_PRIVATE_KEY` in Vercel so the server may send (or allow non-browser apps in EmailJS). Override with `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `SITE_URL`. Template variables: `to_email`, `to_name`, `first_name`, `subject`, `visit_day`, `visit_date`, `visit_window`, `location`, `ticket_link`, `plus_one`, `plus_one_line`, `moved`, `headline`, `message`. The address shows on the backend and in the CSV even if sending fails.
- Holds, so the picker never looks wide open (NOTE FOR LATER: these are not guests). `VISIT_OPEN_DAYS` (default 0, everything open; 6 was used for launch) makes only today through five days out bookable; later preview days show every window as Full and the horizon rolls forward a day each day. `VISIT_HOLDS` (default off) set to `auto` holds a few off-peak windows (4 to 5 or 8 to 9 PM) over the next four days, or an explicit list like `2026-11-06:16,2026-11-08:20`. `VISIT_OPEN_DATES` (default `2026-11-12,2026-11-13`) lists days that are open regardless of the horizon. The backend labels all of these **Held**. Once bookings fill up, set `VISIT_HOLDS=off` and `VISIT_OPEN_DAYS=0` in Vercel to release everything.
- Apple Wallet: `GET /api/wallet?id=` returns a signed .pkpass for a booked visit (champagne gold event ticket, name, day, window, plus one, QR of the ticket link for the bar to scan, link on the back). The ticket page and the email show Add to Apple Wallet once these are set in Vercel: `WALLET_PASS_TYPE_ID`, `WALLET_TEAM_ID`, `WALLET_CERT_B64`, `WALLET_KEY_B64` (and `WALLET_KEY_PASS` if the key has one), `WALLET_WWDR_B64`, each PEM base64-encoded. Images live in `assets/wallet/` and are inlined in `api/_wallet_assets.js`.
- Backend: the "This week in Brentwood" board shows every window with who is in it, each invite shows its visit and plus one, there is a Booked filter, Clear visit frees a window, and the CSV carries both.
- Routes: `GET /api/slots?id=` availability, `POST /api/visit` `{id,date,hour}` book or move, `{id,clear:true}`, `{id,plusOne:"Sam"}`; admin `POST /api/tickets {id, clearVisit:true}`.

## Files

- `index.html` ticket page, `menu.html` cocktail menu (served at `/menu`, linked from the ticket), `admin.html` admin page, `fonts/` the brand fonts (TAYA Maya, Tuppence, Futura Demi), `assets/` wordmarks
- `api/ticket.js` read a ticket (stamps the first open; POST `here` stamps "I'm here"), `api/redeem.js` bartender redemption, `api/tickets.js` admin create (one or many) + list + delete
- `api/_store.js` ticket state kept in Vercel Blob, `api/_slots.js` visit windows and capacity, `api/_hub.js` the Marketing Hub calendar mirror, `api/slots.js` and `api/visit.js` the guest's day and time

## Guest feedback (after the visit)

Two hours after the bartender redeems a ticket (`SURVEY_DELAY_MIN`, default 120), the guest gets a
"How was it?" email at the address they left when booking, with a link to `/f/<ticket>`, "your bar tasting
notes": four pages. Which cocktails they ordered; taste, order-again and satisfaction for each; what stood
out; the menu on variety, flavor range, price/value and clarity; what to add, change or remove; the bar team
on knowledge, friendliness and speed; favorite drink and who makes it best; anything else; may we follow up.
Answers are saved as a JSON file per submission (`feedback/<ticket>/<ms>.json`, private) and show on
`/feedback.html` in the backend (same password, Feedback tab): tiles, cocktails ranked by taste, menu and
team rows, every response by name, CSV export. Each guest is emailed once and can change their answers from
the same link.

The email goes through EmailJS template `template_njpzl8j` (subject `{{subject}}`, content `{{{html_body}}}`;
the design is in `survey-email-template.html`). `EMAILJS_SURVEY_TEMPLATE_ID` overrides it. The schedule in `vercel.json`
runs `/api/survey-cron` every 10 minutes (set `CRON_SECRET` so only Vercel can call it); opening the
backend also sends anything due, so a plan without frequent crons still works.
