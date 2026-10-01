import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTopline, ParsedWorkbook } from "@/lib/parse-workbook";
import { buildPerf, Perf, type PerfRow } from "@/lib/perf";
import { dataChecks } from "@/lib/checks";
import { fetchAllPerf } from "@/lib/data";
import { todayBrisbane } from "@/lib/format";

// Shared by the manual upload (Admin → Performance data) and the hourly Google Sheet sync.

const MEASURES = ["spend", "impressions", "clicks", "leads", "sessions", "sheet_ctr"] as const;
const TOPLINE_KEYS = ["budget_aud", "spend_aud", "spend_pct", "lead_target", "leads_actual", "leads_yoy_pct"] as const;
const eq = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-9);

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** How many values would change if this workbook were imported. */
export async function countChanges(supabase: SupabaseClient, parsed: ParsedWorkbook) {
  const { data: existingRows, error } = await fetchAllPerf(supabase as never);
  fail(error);
  const existing = new Map((existingRows ?? []).map((r) => [`${r.market_id}:${r.channel_id}:${r.week_start}`, r as unknown as Record<string, unknown>]));
  let cells = 0;
  for (const r of parsed.rows) {
    const old = existing.get(`${r.market_id}:${r.channel_id}:${r.week_start}`);
    for (const k of MEASURES) if (!eq(r[k], old?.[k] ?? null)) cells++;
  }
  const { data: oldTop } = await supabase.from("perf_topline").select("*");
  const byMonth = new Map((oldTop ?? []).map((t) => [String(t.month).slice(0, 10), t]));
  let topline = 0;
  for (const t of parsed.topline) for (const k of TOPLINE_KEYS) if (!eq(t[k], byMonth.get(t.month)?.[k] ?? null)) topline++;
  return { cells, topline };
}

/** Upsert the parsed workbook, mark channels with spend Live, and record the import with its data checks. */
export async function applyImport(
  supabase: SupabaseClient,
  parsed: ParsedWorkbook,
  opts: { fileName: string; storagePath: string; importedBy: string | null },
) {
  const now = new Date().toISOString();
  const rows = parsed.rows.map((r) => ({ ...r, source_file: opts.fileName, imported_at: now }));
  for (let i = 0; i < rows.length; i += 500)
    fail((await supabase.from("perf_weekly").upsert(rows.slice(i, i + 500), { onConflict: "market_id,channel_id,week_start" })).error);
  if (parsed.topline.length) fail((await supabase.from("perf_topline").upsert(parsed.topline as ParsedTopline[])).error);

  // A channel with spend in the sheet that's still marked "Not live" becomes Live.
  const withSpend = new Set(parsed.rows.filter((r) => (r.spend ?? 0) > 0).map((r) => `${r.market_id}:${r.channel_id}`));
  const { data: mcs } = await supabase.from("market_channels").select("market_id,channel_id,status");
  const promote = (mcs ?? []).filter((m) => m.status === "not_live" && withSpend.has(`${m.market_id}:${m.channel_id}`));
  for (const m of promote)
    fail((await supabase.from("market_channels").update({ status: "live" }).eq("market_id", m.market_id).eq("channel_id", m.channel_id)).error);

  const [{ data: perfRows }, { data: markets }, { data: channels }, { data: topline }] = await Promise.all([
    fetchAllPerf(supabase as never),
    supabase.from("markets").select("id,code").order("sort"),
    supabase.from("channels").select("id,name").order("sort"),
    supabase.from("perf_topline").select("*"),
  ]);
  const perf = new Perf(
    buildPerf((perfRows ?? []) as PerfRow[]),
    (markets ?? []).map((m) => m.id),
    (channels ?? []).map((c) => c.id),
  );
  const warnings = dataChecks({
    perf,
    markets: markets ?? [],
    channels: channels ?? [],
    topline: (topline ?? []).map((t) => ({ ...t, month: String(t.month) })),
    importWarnings: parsed.warnings,
    today: todayBrisbane(),
  });
  fail(
    (
      await supabase.from("imports").insert({
        file_name: opts.fileName,
        storage_path: opts.storagePath,
        weeks_imported: perf.weeks().length,
        imported_by: opts.importedBy,
        warnings,
      })
    ).error,
  );
  return { weeks: perf.weeks().length, promoted: promote.length };
}
