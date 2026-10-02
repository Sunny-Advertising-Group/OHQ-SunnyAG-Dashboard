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

Every performance number comes from **Whatagraph**. A market × channel with no connected Whatagraph account is treated
as not live. The connected accounts are listed in `lib/whatagraph.ts` (and in Admin → Performance data).

A daily Claude routine (about 6am Brisbane) fetches each account for the last three Sunday–Saturday weeks using the
Whatagraph connector (Google Ads per day, since its "week" dimension runs Monday–Sunday), then calls
`load_whatagraph_weeks(rows, from, note)` in Supabase. That function replaces those weeks, derives the sheet's month /
`W{n}` labels, sets channel status from spend (live = spend in the last four weeks), and records the run in
`settings.whatagraph_sync`, which Admin shows. Organic & AI search = GA4 "Organic Search" + "AI Assistant" sessions,
with GA4 key events stored as its conversions. Google Ads and Microsoft Ads are separate channels (the sheet's
"Paid Search" is the two combined).

Budget, spend, lead target, actual leads and YoY are entered by hand in Admin → Performance data (`perf_topline`).

Calculation rules live in `lib/perf.ts`: ratios always from totals; month-on-month = weekly averages with week counts;
no spend summed across markets; a week shows only if something had spend. Data checks (`lib/checks.ts`) are recomputed
on every view.

### Google Sheet copy

Reporting has a second view: a read-only, formatted copy of the media report tab, refreshed hourly by
`/api/cron/sync-sheet` (`vercel.json`) via the Sheets API. None of its numbers feed the portal. Needs
`GOOGLE_SERVICE_ACCOUNT_KEY` (the whole service account .json, with the Sheets API enabled and the sheet shared to its
email) and `CRON_SECRET`. The old .xlsx parser (`lib/parse-workbook.ts`) is kept for reference but no longer used.

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
removed by `20260930000006_clear_prototype_seed.sql`; performance data now comes only from Whatagraph.
Everything else is entered in Admin.

The admin area (`app/admin`) has its own layout and menu, separate from the client portal (`app/(portal)`).

