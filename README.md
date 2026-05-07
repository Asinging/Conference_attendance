# Event Check-In

Two-day event check-in app. Customers scan a printed QR code, type their email or phone, and get checked in. New attendees fill out a short form. All records live in a Supabase Postgres database.

## Layout

```
attendance/
├── shared/              # event dates + day detection (used by both client and server)
├── sql/                 # database setup + post-import normalization
├── server/              # Node + Express API
├── client/              # React + Vite frontend
├── qr/                  # printable QR poster generator
├── LUMA_IMPORT.md       # how to import Luma CSV into Supabase
└── README.md
```

---

## Setup checklist

Follow these steps in order.

### 1. Configure event dates

Edit [shared/eventConfig.js](shared/eventConfig.js):
- `EVENT_NAME` — appears in the UI and on the printed poster
- `DAY1_DATE` and `DAY2_DATE` — `YYYY-MM-DD` format, used to auto-detect which day to check guests in for
- `TIMEZONE_OFFSET_HOURS` — hours offset from UTC (Nigeria is `+1`)

### 2. Set up Supabase

1. Create a new Supabase project.
2. Go to **SQL Editor** → paste the contents of [sql/setup.sql](sql/setup.sql) → run.
3. Project Settings → API → copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_KEY`

### 3. Import Luma data

Follow [LUMA_IMPORT.md](LUMA_IMPORT.md). Summary:
1. Export approved guests from Luma as CSV.
2. Trim columns to `full_name, email, phone, source`.
3. Import via Supabase Table Editor.
4. Run [sql/post_luma_import.sql](sql/post_luma_import.sql) to normalize emails and phones.

### 4. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from step 2
- `EVENT_TOKEN` — invent a random string (e.g. `openssl rand -hex 16`)
- `CLIENT_ORIGIN` — leave as `http://localhost:5173` for local dev

Install + run:
```bash
npm install
npm run dev
```

The server listens on `http://localhost:4000`. Test with `curl http://localhost:4000/api/health`.

### 5. Configure the client

```bash
cd client
cp .env.example .env
```

Edit `client/.env`:
- `VITE_API_BASE_URL` — `http://localhost:4000` for local dev, your deployed server URL in production
- `VITE_EVENT_TOKEN` — must match the server's `EVENT_TOKEN`

Install + run:
```bash
npm install
npm run dev
```

Open `http://localhost:5173/checkin`.

### 6. Generate the printable QR poster

```bash
cd qr
npm install
node generate.js "https://your-deployed-checkin-url.com/checkin"
```

This writes `event-qr.png`. Then open [qr/print.html](qr/print.html) in a browser, optionally edit the title, and **File → Print** to A4. The QR encodes whatever URL you passed to `generate.js`.

> Tip: print one QR per day, with `?day=1` and `?day=2` in the URL, to override the auto-detection. Example: `https://…/checkin?day=1`

---

## How it works

### Customer flow
1. Customer scans QR → opens `/checkin` on their phone.
2. They type email or phone → `POST /api/lookup`.
3. **Found:** confirm card asks "Is this you?" → on Yes, `POST /api/checkin` updates `day1_checkin` or `day2_checkin` (only if currently `NULL`, so re-scans don't overwrite).
4. **Not found:** registration form for full name, email, phone, address → `POST /api/register` inserts the record and marks today's day as checked in.
5. Success screen for 8 seconds, then resets to the lookup screen.

### Day detection
- The client computes `day` from `eventConfig.js` and sends it on every request.
- A `?day=1` or `?day=2` URL query string overrides auto-detection — useful if you want a single QR per day, or if you need to manually correct on-site.

### Idempotency
- Re-scanning never overwrites a check-in timestamp. The API returns `alreadyCheckedIn: true` and the UI shows "You're already in".
- Duplicate registration attempts (same email or phone already in `attendees`) return a 409 with a friendly message.

### Audit log
- Every successful check-in writes a row to the `check_ins` table with `attendee_id`, `day`, `checked_in_at`, and `source_ip`.
- Useful for "who checked in at 9:14am" or "did anyone double-scan" after the event.

### Security
- Write endpoints require an `x-event-token` header that matches `EVENT_TOKEN` on the server.
- The token is shipped in the client bundle, so this is anti-casual-abuse, not real auth.
- `service_role` Supabase key is **server-side only**. Never expose it to the client.

---

## Production notes (for deployment)

- The server is a plain Node/Express app — deploy to Railway, Render, Fly, or anywhere that runs Node.
- The client is a static SPA (`npm run build` outputs `dist/`) — deploy to Vercel, Netlify, Cloudflare Pages, or the same host as the server.
- After deploying the client, regenerate the QR with the production URL.
- Update `CLIENT_ORIGIN` on the server to match the deployed client origin.

---

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `unauthorized` on every request | `VITE_EVENT_TOKEN` (client) doesn't match `EVENT_TOKEN` (server). |
| Lookup says "not found" for someone you imported | `email_normalized` / `phone_normalized` weren't populated — re-run [sql/post_luma_import.sql](sql/post_luma_import.sql). |
| "Today is not an event day" warning | Today's date doesn't match `DAY1_DATE` or `DAY2_DATE` in `eventConfig.js`. Either fix the dates or pass `?day=1` / `?day=2` in the URL. |
| Phone lookup fails | The customer's phone format must reduce to the same last-10-digits as the imported value. The normalizer handles `+234`, leading `0`, spaces, dashes, and parentheses — anything else, look at the raw value in Supabase. |
