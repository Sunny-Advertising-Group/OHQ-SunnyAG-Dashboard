// Generates supabase/migrations/*_seed.sql from the prototype's PERF_SEED
// (itself parsed from "OfficeHQ - Media Report & Tracker 2026.xlsx").
// Run once: node scripts/build-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../docs/prototype/officehq-portal.html", import.meta.url), "utf8");
const m = html.match(/const PERF_SEED = (\{.*?\});\n/s);
if (!m) throw new Error("PERF_SEED not found");
const seed = JSON.parse(m[1]);

const q = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const SOURCE = "OfficeHQ - Media Report & Tracker 2026.xlsx";

const out = [];
out.push("-- Seed content. Performance rows come from the prototype's PERF_SEED,");
out.push(`-- parsed from "${SOURCE}". Re-upload the workbook in Admin → Performance data to refresh.`);
out.push("");

out.push(`insert into public.markets (id, code, name, country, currency, tz, tz_label, note, sort) values
  ('au', 'AU', 'OfficeHQ AU', 'Australia', 'AUD', 'Australia/Sydney', 'Sydney', '', 1),
  ('nz', 'NZ', 'ReceptionHQ NZ', 'New Zealand', 'NZD', 'Pacific/Auckland', 'Auckland', '', 2),
  ('uk', 'UK', 'ReceptionHQ UK', 'United Kingdom', 'GBP', 'Europe/London', 'London',
   'GDPR cookie consent was implemented mid-July 2026 and is denied by default. Actual traffic and conversions will likely be significantly higher than what is tracked from here on.', 3),
  ('us', 'US', 'ReceptionHQ US', 'United States', 'USD', 'America/New_York', 'New York', '', 4);
`);

const CHANNELS = [
  ["google", "Google Ads", "#FDB600"],
  ["meta", "Meta", "#585858"],
  ["linkedin", "LinkedIn", "#9E9E9E"],
  ["programmatic", "Programmatic", "#C2C2C2"],
  ["microsoft", "Microsoft Ads", "#C2C2C2"],
  ["chatgpt", "ChatGPT ads", "#E0E0E0"],
  ["organic", "Organic & AI search", "#E0E0E0"],
];
out.push(
  "insert into public.channels (id, name, hex, sort) values\n" +
    CHANNELS.map(([id, n, h], i) => `  (${q(id)}, ${q(n)}, ${q(h)}, ${i + 1})`).join(",\n") +
    ";\n",
);

const mc = [];
for (const mid of ["au", "nz", "uk", "us"]) {
  for (const [cid] of CHANNELS) {
    const s = seed.markets[mid]?.[cid];
    const hasSpend = s?.spend?.some((v) => v > 0);
    const status = cid === "organic" ? "awaiting" : hasSpend ? "live" : "not_live";
    mc.push(`  (${q(mid)}, ${q(cid)}, ${q(status)})`);
  }
}
out.push("insert into public.market_channels (market_id, channel_id, status) values\n" + mc.join(",\n") + ";\n");

out.push(`insert into public.links (label, description, url, icon, sort) values
  ('Whatagraph dashboard', 'Live cross-channel reporting', '', 'chart', 1),
  ('Media WIP', 'Work in progress & open actions', '', 'sheet', 2),
  ('Flight plan', 'Channel budgets & timings by market', '', 'cal', 3),
  ('Media report & tracker', 'Weekly numbers behind this portal', '', 'sheet', 4),
  ('Creative folder', 'Approved assets by market', '', 'folder', 5),
  ('Monthly reports', 'Archive of past reports', '', 'folder', 6);
`);

out.push(`insert into public.changes (date, market_id, channel_id, type, text) values
  ('2026-08-23', null, 'meta', 'Budget', 'Meta weekly spend stepped up in the US and UK from w/c 23 Aug. AU Meta has been scaling steadily since early August.'),
  ('2026-07-15', 'uk', null, 'Tracking', 'GDPR cookie consent went live on the UK site (denied by default). Tracked leads now understate actual results.');
`);

const FUNNEL = [
  "Upper",
  "Mid",
  "Lower – Retargeting free trials",
  "Lower – Retargeting website",
  "Lower – Retargeting checkout",
  "Lower – Abandoned cart",
];
out.push(
  "insert into public.tracker_rows (funnel_stage, sort) values\n" +
    FUNNEL.map((f, i) => `  (${q(f)}, ${i + 1})`).join(",\n") +
    ";\n",
);

out.push(`insert into public.team (name, role, focus, email, phone, escalation, sort) values
  ('Lily Hunter', 'Media Account Coordinator', 'Day-to-day media, programmatic, reporting', 'lily@sunnyadvertising.com.au', '', false, 1),
  ('', 'Account Director', 'Strategy & escalation', '', '', true, 2),
  ('', 'Paid Search Specialist', 'Google & Microsoft Ads', '', '', false, 3),
  ('', 'Paid Social Specialist', 'Meta & LinkedIn', '', '', false, 4);
`);

out.push(`insert into public.settings (key, value) values
  ('team_hours', 'Sunny works 8:30am–5pm Mon–Fri Queensland time (AEST, no daylight saving).');
`);

// Performance rows: every market/channel/week present in the sheet, blanks as null.
const rows = [];
for (const [mid, chans] of Object.entries(seed.markets)) {
  for (const [cid, s] of Object.entries(chans)) {
    seed.weeks.forEach((w, i) => {
      const v = (k) => s[k]?.[i] ?? null;
      // All-blank rows carry no information; the importer writes them, the seed skips them.
      if (["spend", "impressions", "clicks", "leads", "sessions", "ctr"].every((k) => v(k) == null)) return;
      rows.push(
        `  (${q(mid)}, ${q(cid)}, ${q(w.date)}, ${q(w.month + "-01")}, ${q(w.label)}, ${q(v("spend"))}, ${q(v("impressions"))}, ${q(v("clicks"))}, ${q(v("leads"))}, ${q(v("sessions"))}, ${q(v("ctr"))})`,
      );
    });
  }
}
out.push(
  "insert into public.perf_weekly (market_id, channel_id, week_start, report_month, week_label, spend, impressions, clicks, leads, sessions, sheet_ctr) values\n" +
    rows.join(",\n") +
    ";\n",
);

out.push(`update public.perf_weekly set source_file = ${q(SOURCE)};\n`);

// Topline: the prototype defaulted blank cells to 0. Blank stays null here.
const T = seed.topline;
const pick = (label, mk) => {
  const v = T[label]?.[mk];
  return v ? v : null;
};
const months = Object.keys(T["Monthly Marketing Budget (AUD)"] || {}).sort();
out.push(
  "insert into public.perf_topline (month, budget_aud, spend_aud, spend_pct, lead_target, leads_actual, leads_yoy_pct) values\n" +
    months
      .map(
        (mk) =>
          `  (${q(mk + "-01")}, ${q(pick("Monthly Marketing Budget (AUD)", mk))}, ${q(pick("Monthly Marketing Spend (AUD)", mk))}, ${q(pick("Spend %", mk))}, ${q(pick("Lead Target", mk))}, ${q(pick("Lead Tracking (Actual - minus Fraud)", mk))}, ${q(pick("Lead % Change YoY", mk))})`,
      )
      .join(",\n") +
    ";\n",
);

out.push(`insert into public.imports (file_name, storage_path, weeks_imported, warnings) values
  (${q(SOURCE)}, '', ${seed.weeks.length}, '[{"severity":"hi","text":"Seeded from the prototype. Upload the latest workbook in Admin → Performance data to replace it."}]'::jsonb);
`);

// The seed isn't an editor write, so it shouldn't sit in the audit log.
out.push("delete from public.audit_log;");

writeFileSync(new URL("../supabase/migrations/20260930000002_seed.sql", import.meta.url), out.join("\n"));
console.log(`Wrote seed: ${rows.length} perf rows, ${months.length} topline months`);
