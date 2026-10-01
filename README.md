# OfficeHQ × Sunny: Client Media Portal

Client-facing portal for OfficeHQ / ReceptionHQ paid media. The clickable prototype
(`docs/prototype/officehq-portal.html`) is the reference for layout, copy and behaviour.

**Stack:** Next.js 16 (App Router) · Supabase (Auth, Postgres, Storage, RLS) · Vercel (Sydney).

## Environments

| | |
|---|---|
| Supabase project | `officehq-portal` (`lsxcohsvnobozmrvtakm`, ap-southeast-2) |
| Vercel project | `officehq-portal` (team `sunny-advertising`, functions in `syd1`) |

Environment variables (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`: server only; Admin → Users (invite links, roles, revoke)
- `NEXT_PUBLIC_SITE_URL`: the portal's public URL; invite links redirect to `${NEXT_PUBLIC_SITE_URL}/invite`
- Optional `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_TO`: email the account team when a client requests creative changes.
  Without them the request is still saved on the row and shown in Admin → Creative tracker.

## Access

Invite only, same pattern as Sunny Sphere. An admin opens **Admin → Users → Generate invite link**, copies the link and
sends it. The invitee lands on `/invite`, sets a password, and signs in with email + password from then on.
**New link** next to a person re-sends an invite or resets a password.

Roles (`profiles.role`): `viewer` (client: reads everything, approves creative), `editor` (Sunny: writes content),
`admin` (editor + manages people). Editor/admin is limited to `@sunnyadvertising.com.au` addresses.

- `/admin/*` is gated in `proxy.ts` **and** by RLS on every table. The Users tab is admin-only.
- Sessions end 8 hours after sign-in (`proxy.ts`). Removing a user deletes their auth account, which ends access immediately.
- Viewers can't update `tracker_rows` directly. `respond_to_tracker()` lets them move a row from *Awaiting approval* to
  *Approved* / *Changes requested* only, and writes a "What's changed" entry on approval.
- Every write to a content table is logged in `audit_log` (who, table, before, after).

## Performance data

Admin → Performance data accepts `OfficeHQ - Media Report & Tracker 2026.xlsx`. The file is parsed on the server
(`lib/parse-workbook.ts`, a port of the prototype's `parseWorkbook()`), stored in the `imports` bucket, and previewed
(weeks added / changed, before → after values) before anything is written. Commit upserts by
`(market, channel, week_start)`; blank cells stay null.

Calculation rules live in `lib/perf.ts`: ratios always from totals; month-on-month = weekly averages with week counts;
no spend summed across markets; blank clicks estimated from CTR × impressions and flagged `*`; a week shows only if
something had spend. Data checks (`lib/checks.ts`) are recomputed on every view and saved with each import.

### Hourly Google Sheet sync

`vercel.json` runs `/api/cron/sync-sheet` every hour. It exports the "OfficeHQ - Media Report & Tracker 2026" Google
Sheet as .xlsx through the Drive API (service account, read-only), parses it with the same parser as the upload, and
imports only if a value changed. The result is shown in Admin → Performance data, which also has **Sync now**.
Needs `GOOGLE_SERVICE_ACCOUNT_KEY` (with the Drive API enabled and the sheet shared to the service account's email)
and `CRON_SECRET`.

## Whatagraph

One share link per market × channel. "Open in Whatagraph" is the default. When a link is saved, the server fetches it
and checks `X-Frame-Options` / CSP `frame-ancestors`; the embed toggle only appears if Whatagraph allows framing.

## Development

```bash
npm install
cp .env.example .env.local   # fill in
npm run dev
npm test                     # calculation + workbook parser tests
npm run lint && npm run typecheck
```

Database changes are SQL migrations in `supabase/migrations/`. The prototype seed (`scripts/build-seed.mjs`) was
removed by `20260930000006_clear_prototype_seed.sql`; performance data now comes only from the media report
(the "OfficeHQ - Media Report & Tracker 2026" Google Sheet, Master Report tab). Everything else is entered in Admin.

The admin area (`app/admin`) has its own layout and menu, separate from the client portal (`app/(portal)`).

## v2 (later)

Windsor.ai or Supermetrics writing nightly into `perf_weekly` (Vercel Cron or the connector's warehouse destination),
with the upload kept as a manual override. Reconcile one month against Whatagraph first.
