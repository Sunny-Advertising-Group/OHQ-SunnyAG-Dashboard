import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPerf, delta, Perf, type PerfRow } from "./perf.ts";

const M = ["au", "nz", "uk", "us"];
const C = ["google", "meta", "linkedin", "programmatic", "microsoft", "chatgpt", "organic"];

function row(p: Partial<PerfRow> & Pick<PerfRow, "market_id" | "channel_id" | "week_start" | "report_month">): PerfRow {
  return { week_label: "W1", spend: null, impressions: null, clicks: null, leads: null, sessions: null, sheet_ctr: null, ...p };
}

const rows: PerfRow[] = [
  row({ market_id: "au", channel_id: "google", week_start: "2026-08-02", report_month: "2026-08-01", spend: 100, impressions: 1000, clicks: 100, leads: 10 }),
  row({ market_id: "au", channel_id: "google", week_start: "2026-08-09", report_month: "2026-08-01", spend: 300, impressions: 1000, clicks: 50, leads: 10 }),
  row({ market_id: "au", channel_id: "google", week_start: "2026-09-06", report_month: "2026-09-01", spend: 200, impressions: 2000, clicks: null, sheet_ctr: 0.05, leads: 5 }),
  row({ market_id: "us", channel_id: "google", week_start: "2026-09-06", report_month: "2026-09-01", spend: "999", leads: 7 }),
  // A week with no spend anywhere is not shown.
  row({ market_id: "au", channel_id: "linkedin", week_start: "2026-09-13", report_month: "2026-09-01", spend: 0, leads: 0 }),
];
const perf = new Perf(buildPerf(rows), M, C);

test("only weeks with spend > 0 somewhere are shown", () => {
  assert.deepEqual(perf.weeks().map((w) => w.date), ["2026-08-02", "2026-08-09", "2026-09-06"]);
});

test("ratios are recomputed from totals, never averaged", () => {
  const a = perf.agg("au", ["google"], "2026-08");
  // weekly CTRs were 10% and 5%; the averaged ratio would be 7.5%, from totals it's 150/2000
  assert.equal(a.ctr, 150 / 2000);
  assert.equal(a.cpc, 400 / 150);
  assert.equal(a.cpl, 400 / 20);
  assert.equal(a.cvr, 20 / 150);
  assert.equal(a.spendW, 200);
  assert.equal(a.leadsW, 10);
  assert.equal(a.n, 2);
});

test("blank clicks are estimated from CTR × impressions and flagged", () => {
  const r = perf.weekRow("au", "google", 2)!;
  assert.equal(r.clicks, 100);
  assert.equal(r.derived, true);
  const a = perf.agg("au", ["google"], "2026-09");
  assert.equal(a.derived, true, "totals using an estimate must carry the flag");
});

test("month-on-month note labels the week counts", () => {
  assert.deepEqual(perf.months(), { cur: "2026-09", prev: "2026-08", all: ["2026-08", "2026-09"] });
  assert.equal(perf.monthsNote(), "September to date (1 wk) vs August (2 wks), weekly averages");
});

test("leads can be summed across markets", () => {
  assert.equal(perf.leadsAcrossMarkets("2026-09"), 12);
});

test("deltas: good/bad coloured, spend neutral, small moves flat", () => {
  assert.deepEqual(delta(110, 100), { tone: "up", text: "▲ 10%" });
  assert.deepEqual(delta(110, 100, true), { tone: "down", text: "▲ 10%" });
  assert.deepEqual(delta(110, 100, false, true), { tone: "flat", text: "▲ 10%" });
  assert.deepEqual(delta(101, 100), { tone: "flat", text: "flat" });
  assert.deepEqual(delta(5, 0), { tone: "flat", text: "new" });
});

test("in-progress week is detected", () => {
  assert.equal(perf.inProgressWeek("2026-09-08"), "2026-09-06");
  assert.equal(perf.inProgressWeek("2026-09-20"), null);
});
