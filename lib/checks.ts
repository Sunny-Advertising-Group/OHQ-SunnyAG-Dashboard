// Admin-only data checks, recomputed from the database on every view and saved
// with each import. Severity: hi = Fix, md = Check, lo = Note.
import type { Perf } from "./perf";
import { fmtDate, monthName } from "./format";

export interface Check {
  severity: "hi" | "md" | "lo";
  text: string;
}

interface ToplineLike {
  month: string;
  budget_aud: number | null;
  spend_aud: number | null;
  spend_pct: number | null;
  lead_target: number | null;
  leads_actual: number | null;
  leads_yoy_pct: number | null;
}

const TOPLINE_FIELDS: [keyof Omit<ToplineLike, "month">, string][] = [
  ["spend_pct", "Spend %"],
  ["lead_target", "Lead target"],
  ["leads_actual", "Leads actual"],
  ["leads_yoy_pct", "Lead % change YoY"],
];

export function dataChecks(opts: {
  perf: Perf;
  markets: { id: string; code: string }[];
  channels: { id: string; name: string }[];
  topline: ToplineLike[];
  importWarnings: Check[];
  today: string;
}): Check[] {
  const { perf, markets, channels, topline, importWarnings, today } = opts;
  const out: Check[] = [];

  // From the sheet itself (only visible at import time): ratio rows summed, unknown channels.
  out.push(...importWarnings);

  const empty = TOPLINE_FIELDS.filter(([k]) => !topline.some((t) => t[k] != null)).map(([, l]) => l);
  if (empty.length) out.push({ severity: "md", text: `Topline rows with no values yet: ${empty.join(", ")}.` });

  const { cur } = perf.months();
  if (cur) {
    const t = topline.find((x) => x.month.startsWith(cur));
    const missing = [!t?.budget_aud && "budget", !t?.spend_aud && "spend"].filter(Boolean);
    if (missing.length)
      out.push({ severity: "md", text: `${monthName(cur, true)} ${missing.join(" and ")} ${missing.length > 1 ? "aren't" : "isn't"} entered in the topline section yet.` });
  }

  const gaps: string[] = [];
  for (const m of markets)
    for (const c of channels) {
      const s = perf.series(m.id, c.id);
      if (!s) continue;
      for (const w of perf.weeks()) {
        if ((s.spend[w.i] || 0) <= 0) continue;
        if (s.clicks[w.i] == null && c.id !== "organic") gaps.push(`${m.code} ${c.name} clicks, w/c ${fmtDate(w.date)}`);
        if (s.leads[w.i] == null) gaps.push(`${m.code} ${c.name} leads, w/c ${fmtDate(w.date)}`);
      }
    }
  if (gaps.length)
    out.push({
      severity: "md",
      text: `Blank cells in weeks with spend (${gaps.length}): ${gaps.join("; ")}. Clicks are estimated from CTR × impressions where possible and flagged with *.`,
    });

  const organicEmpty = markets.every((m) => {
    const s = perf.series(m.id, "organic");
    return !s || (!s.sessions.some((v) => v != null && v !== 0) && !s.leads.some((v) => v != null && v !== 0));
  });
  if (organicEmpty) out.push({ severity: "lo", text: "Organic & AI search sessions and leads are blank for every market." });

  const partial = perf.inProgressWeek(today);
  if (partial) out.push({ severity: "lo", text: `The week of ${fmtDate(partial)} is still in progress, so its numbers will change.` });

  return out;
}
