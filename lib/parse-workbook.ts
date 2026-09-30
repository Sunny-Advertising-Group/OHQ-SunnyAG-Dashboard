// Port of the prototype's parseWorkbook() for "OfficeHQ - Media Report & Tracker 2026.xlsx".
//
// Layout of the "Master Report" tab:
//   Row 1: month dates as Excel serials, at the W1 column of each month
//   Row 2: week labels (W1..W5) and "Monthly Total"
//   Row 3: week-commencing (Sunday) day number
//   Rows above the first market header: topline (read from "Monthly Total" columns)
//   Market header rows: "OFFICEHQ - AU", "RECEPTIONHQ - US" / "- UK" (carries a GDPR note) / "- NZ"
//   Channel in column A, metric in column B. Labels may carry trailing spaces.
//
// Only raw measures are imported (spend, impressions, clicks, leads, sessions).
// The sheet's weekly CTR is kept solely to estimate blank clicks (flagged in the UI).
// Its CPC / Conversion Rate rows are ignored. Blank cells stay null, never 0.

export type Cell = string | number | boolean | Date | null | undefined;

export interface ParsedRow {
  market_id: string;
  channel_id: string;
  week_start: string;
  report_month: string; // YYYY-MM-01
  week_label: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  sessions: number | null;
  sheet_ctr: number | null;
}

export interface ParsedTopline {
  month: string; // YYYY-MM-01
  budget_aud: number | null;
  spend_aud: number | null;
  spend_pct: number | null;
  lead_target: number | null;
  leads_actual: number | null;
  leads_yoy_pct: number | null;
}

export type Severity = "hi" | "md" | "lo";
export interface Warning {
  severity: Severity;
  text: string;
}

export interface ParsedWorkbook {
  weeks: { date: string; label: string; month: string }[];
  rows: ParsedRow[];
  topline: ParsedTopline[];
  warnings: Warning[];
}

const MARKETS: [string, string][] = [
  ["OFFICEHQ - AU", "au"],
  ["RECEPTIONHQ - US", "us"],
  ["RECEPTIONHQ - UK", "uk"],
  ["RECEPTIONHQ - NZ", "nz"],
];
const MARKET_CODE: Record<string, string> = { au: "AU", us: "US", uk: "UK", nz: "NZ" };

const CHANNELS: Record<string, string> = {
  "paid search": "google",
  "organic search & generative ai (combined)": "organic",
  "paid linkedin": "linkedin",
  "paid meta": "meta",
  "paid chatgpt": "chatgpt",
  programatic: "programmatic", // (sic) as in the sheet
  programmatic: "programmatic",
  "paid programmatic": "programmatic",
  "paid microsoft": "microsoft",
  microsoft: "microsoft",
  "microsoft ads": "microsoft",
};
const CHANNEL_NAME: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta",
  linkedin: "LinkedIn",
  programmatic: "Programmatic",
  microsoft: "Microsoft Ads",
  chatgpt: "ChatGPT ads",
  organic: "Organic & AI search",
};

type Metric = "spend" | "impressions" | "clicks" | "leads" | "sessions" | "ctr" | "ratio";
function metricOf(label: string): Metric | null {
  const l = label.trim().toLowerCase();
  if (l === "spend") return "spend";
  if (l === "impressions") return "impressions";
  if (l === "clicks") return "clicks";
  if (l === "ctr") return "ctr";
  if (l === "cpc" || l.startsWith("conv") || l === "cpl") return "ratio"; // ignored, but checked
  if (l.startsWith("sessions")) return "sessions";
  if (l.startsWith("leads")) return "leads";
  return null;
}

const TOPLINE: [RegExp, keyof Omit<ParsedTopline, "month">][] = [
  [/^monthly marketing budget/i, "budget_aud"],
  [/^monthly marketing spend/i, "spend_aud"],
  [/^spend\s*%/i, "spend_pct"],
  [/^lead target/i, "lead_target"],
  [/^lead tracking/i, "leads_actual"],
  [/^lead\s*%\s*change/i, "leads_yoy_pct"],
];
export const TOPLINE_LABELS: Record<keyof Omit<ParsedTopline, "month">, string> = {
  budget_aud: "Monthly marketing budget",
  spend_aud: "Monthly marketing spend",
  spend_pct: "Spend %",
  lead_target: "Lead target",
  leads_actual: "Leads actual",
  leads_yoy_pct: "Lead % change YoY",
};

const pad = (x: number) => String(x).padStart(2, "0");
const numOrNull = (v: Cell): number | null => (typeof v === "number" && isFinite(v) ? v : null);
function serialToYM(v: number): { y: number; m: number } {
  const d = new Date(Math.round((v - 25569) * 864e5));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}
function shiftMonth(y: number, m: number, by: number) {
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}
const str = (v: Cell) => (typeof v === "string" ? v.trim() : "");

export function parseRows(rows: Cell[][]): ParsedWorkbook {
  const warnings: Warning[] = [];
  const r1 = rows[0] || [],
    r2 = rows[1] || [],
    r3 = rows[2] || [];

  // ---- Columns: weeks and monthly totals
  let month: { y: number; m: number } | null = null;
  const weeks: { col: number; date: string; label: string; month: string }[] = [];
  const totals: Record<string, number> = {}; // YYYY-MM -> column
  const width = Math.max(r1.length, r2.length, r3.length);
  for (let c = 2; c < width; c++) {
    if (r1[c] instanceof Date) month = { y: (r1[c] as Date).getUTCFullYear(), m: (r1[c] as Date).getUTCMonth() + 1 };
    else if (typeof r1[c] === "number" && (r1[c] as number) > 30000) month = serialToYM(r1[c] as number);
    const lab = str(r2[c]);
    if (!month) continue;
    const mk = `${month.y}-${pad(month.m)}`;
    if (/^W\d/i.test(lab) && typeof r3[c] === "number") {
      const day = r3[c] as number;
      // Row 3 only holds the day number. A W1 can start in the previous month
      // (e.g. w/c 27 Sep for October) and a late week can run into the next one,
      // so pick the calendar month that puts this week nearest where it should be:
      // 7 days after the previous week, or at the start of the month for the first.
      const prev = weeks[weeks.length - 1];
      const expected = prev ? Date.parse(prev.date) + 7 * 864e5 : Date.UTC(month.y, month.m - 1, 1);
      let best = "";
      let bestGap = Infinity;
      for (const by of [-1, 0, 1]) {
        const ym = shiftMonth(month.y, month.m, by);
        const t = Date.UTC(ym.y, ym.m - 1, day);
        if (new Date(t).getUTCDate() !== day) continue; // e.g. 31 Sep doesn't exist
        const gap = Math.abs(t - expected);
        if (gap < bestGap) {
          bestGap = gap;
          best = `${ym.y}-${pad(ym.m)}-${pad(day)}`;
        }
      }
      weeks.push({ col: c, date: best, label: lab.toUpperCase(), month: mk });
    }
    if (/^monthly total$/i.test(lab)) totals[mk] = c;
  }
  if (!weeks.length) throw new Error("Couldn't find the week columns (W1, W2…) in rows 1–3 of the Master Report tab.");
  const dupes = weeks.filter((w, i) => weeks.findIndex((x) => x.date === w.date) !== i);
  if (dupes.length) throw new Error(`Two week columns share the same date (${dupes[0].date}). Check row 3 of the sheet.`);

  // ---- Rows
  const out = new Map<string, ParsedRow>();
  const topline = new Map<string, ParsedTopline>();
  const ratioSums: string[] = [];
  const unknownChannels = new Set<string>();
  let market: string | null = null;
  let chan: string | null = null;
  let chanLabel = "";

  const rowFor = (mid: string, cid: string, w: (typeof weeks)[number]) => {
    const key = `${mid}:${cid}:${w.date}`;
    let r = out.get(key);
    if (!r) {
      r = {
        market_id: mid,
        channel_id: cid,
        week_start: w.date,
        report_month: `${w.month}-01`,
        week_label: w.label,
        spend: null,
        impressions: null,
        clicks: null,
        leads: null,
        sessions: null,
        sheet_ctr: null,
      };
      out.set(key, r);
    }
    return r;
  };

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] || [];
    const a = str(row[0]);
    const b = str(row[1]);

    if (a) {
      const hit = MARKETS.find(([k]) => a.toUpperCase().startsWith(k));
      if (hit) {
        market = hit[1];
        chan = null;
        continue;
      }
      if (market) {
        const cid = CHANNELS[a.toLowerCase()];
        if (cid) {
          chan = cid;
          chanLabel = CHANNEL_NAME[cid];
        } else if (b && metricOf(b)) {
          // A metric row under a channel name we don't know: skip it rather than
          // filing it under the previous channel.
          chan = null;
          unknownChannels.add(a);
        }
      }
    }
    if (!b) continue;

    if (!market) {
      const t = TOPLINE.find(([re]) => re.test(b));
      if (!t) continue;
      for (const [mk, col] of Object.entries(totals)) {
        const tl = topline.get(mk) ?? {
          month: `${mk}-01`,
          budget_aud: null,
          spend_aud: null,
          spend_pct: null,
          lead_target: null,
          leads_actual: null,
          leads_yoy_pct: null,
        };
        tl[t[1]] = numOrNull(row[col]);
        topline.set(mk, tl);
      }
      continue;
    }

    const metric = metricOf(b);
    if (!chan || !metric) continue;

    // Check whether the sheet's Monthly Total for a ratio row is a SUM of weekly ratios.
    if (metric === "ctr" || metric === "ratio") {
      for (const [mk, col] of Object.entries(totals)) {
        const vals = weeks.filter((w) => w.month === mk).map((w) => numOrNull(row[w.col])).filter((v): v is number => v != null);
        const tot = numOrNull(row[col]);
        const sum = vals.reduce((x, y) => x + y, 0);
        if (vals.length >= 2 && tot != null && sum > 0 && Math.abs(tot - sum) / sum < 0.01) {
          const shown = metric === "ctr" || /conv/i.test(b) ? `${(tot * 100).toFixed(0)}%` : tot.toFixed(2);
          ratioSums.push(`${MARKET_CODE[market]} ${chanLabel} ${monthLabel(mk)} ${b} reads ${shown}`);
        }
      }
      if (metric === "ratio") continue;
    }

    for (const w of weeks) {
      const v = numOrNull(row[w.col]);
      const pr = rowFor(market, chan, w);
      if (metric === "ctr") pr.sheet_ctr = v;
      else pr[metric] = v;
    }
  }

  if (!out.size) throw new Error('Couldn\'t find the market sections (e.g. "OFFICEHQ - AU") in the Master Report tab.');

  if (ratioSums.length)
    warnings.push({
      severity: "hi",
      text: `The sheet's "Monthly Total" rows add up weekly ratios instead of recalculating them (${ratioSums.slice(0, 3).join("; ")}${ratioSums.length > 3 ? `; +${ratioSums.length - 3} more` : ""}). The portal recalculates every ratio from totals, but the sheet should use totals too.`,
    });
  for (const u of unknownChannels)
    warnings.push({ severity: "md", text: `Channel "${u}" isn't recognised, so its rows were skipped. Rename it in the sheet or ask for it to be mapped.` });

  return {
    weeks: weeks.map(({ date, label, month }) => ({ date, label, month })),
    rows: [...out.values()],
    topline: [...topline.values()],
    warnings,
  };
}

function monthLabel(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
}

export async function parseWorkbookBuffer(buf: ArrayBuffer | Uint8Array): Promise<ParsedWorkbook> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: "array" });
  const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === "master report");
  if (!name) throw new Error('No "Master Report" tab found in that file.');
  const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
  return parseRows(rows);
}
