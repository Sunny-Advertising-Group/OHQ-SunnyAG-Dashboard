import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseRows, parseWorkbookBuffer, type Cell } from "./parse-workbook.ts";

// Excel serials: 1 Aug 2026 = 46235, 1 Sep 2026 = 46266
const AUG = 46235;
const SEP = 46266;

// Columns: A label, B metric, C..G Aug W1..W5, H Aug total, I..K Sep W1..W3, L Sep total
function sheet(): Cell[][] {
  const r1: Cell[] = [null, null, AUG, null, null, null, null, null, SEP, null, null, null];
  const r2: Cell[] = [null, null, "W1", "W2", "W3", "W4", "W5", "Monthly Total", "W1", "W2", "W3", "Monthly Total"];
  const r3: Cell[] = [null, null, 2, 9, 16, 23, 30, null, 6, 13, 20, null];
  return [
    r1,
    r2,
    r3,
    [],
    [null, "Monthly Marketing Budget (AUD) ", null, null, null, null, null, 108381.33, null, null, null, null],
    [null, "Monthly Marketing Spend (AUD)", null, null, null, null, null, 88133.15, null, null, null, null],
    [null, "Lead Target", null, null, null, null, null, null, null, null, null, null],
    ["OFFICEHQ - AU", null],
    ["Paid Search ", "Spend", 4061.5, 4490.14, 3669.64, 4411.4, 4097.83, 20730.51, 4852.47, 6763.99, 5039.26, 16655.72],
    [null, "Impressions", 1737, 1723, 1435, 1690, 2134, 8719, 2224, 2816, 3066, 8106],
    [null, "Clicks", 250, 266, 192, 189, 249, 1146, 255, 231, 236, 722],
    // Sheet's Monthly Total CTR = SUM of weekly CTRs (the bug the portal must not repeat)
    [null, "CTR", 0.1439, 0.1544, 0.1338, 0.1118, 0.1167, 0.6606, 0.1147, 0.082, 0.077, 0.2737],
    [null, "CPC", 16.25, 16.88, 19.11, 23.34, 16.46, 92.04, 19.03, 29.28, 21.35, 69.66],
    [null, "Leads ", 15, 16, 13.01, 9.78, 12.55, 66.34, 9.97, 19.73, 10, 39.7],
    ["Paid Meta", "Spend", 339.29, 396.53, 417.63, 564.43, 649.61, null, 912.45, 1004.84, 1166.35, null],
    [null, "Impressions", 16409, 19802, 20485, 39836, 39631, null, 64766, 84655, 103748, null],
    [null, "Clicks", 223, 331, null, null, null, null, 1170, 1672, null, null],
    [null, "CTR", 0.0136, 0.0167, 0.0236, 0.0222, 0.0223, null, 0.0181, 0.0198, 0.0181, null],
    ["Paid TikTok", "Spend", 10, 10, 10, 10, 10, null, null, null, null, null],
    ["RECEPTIONHQ - UK (GDPR consent implemented mid-July)", null],
    ["Programatic", "Spend", null, null, null, null, null, null, null, null, null, null],
    ["Organic Search & Generative AI (combined)", "Sessions (GA4)", null, null, null, null, null, null, null, null, null, null],
    [null, "Leads", null, null, null, null, null, null, null, null, null, null],
  ];
}

test("reads weeks from rows 1–3 and assigns them to report months", () => {
  const p = parseRows(sheet());
  assert.equal(p.weeks.length, 8);
  assert.deepEqual(p.weeks[0], { date: "2026-08-02", label: "W1", month: "2026-08" });
  assert.deepEqual(p.weeks[4], { date: "2026-08-30", label: "W5", month: "2026-08" });
  assert.deepEqual(p.weeks[5], { date: "2026-09-06", label: "W1", month: "2026-09" });
});

test("imports raw measures, trims labels, keeps blanks as null", () => {
  const p = parseRows(sheet());
  const g = p.rows.find((r) => r.market_id === "au" && r.channel_id === "google" && r.week_start === "2026-08-02")!;
  assert.equal(g.spend, 4061.5);
  assert.equal(g.clicks, 250);
  assert.equal(g.leads, 15);
  assert.equal(g.sheet_ctr, 0.1439);
  const m = p.rows.find((r) => r.market_id === "au" && r.channel_id === "meta" && r.week_start === "2026-08-16")!;
  assert.equal(m.clicks, null, "blank clicks must stay null, not 0");
  assert.equal(m.sheet_ctr, 0.0236);
  const prog = p.rows.find((r) => r.market_id === "uk" && r.channel_id === "programmatic")!;
  assert.equal(prog.spend, null);
});

test("reads organic sessions and leads, market header with a note", () => {
  const p = parseRows(sheet());
  const o = p.rows.filter((r) => r.market_id === "uk" && r.channel_id === "organic");
  assert.equal(o.length, 8);
  assert.ok(o.every((r) => r.sessions === null && r.leads === null));
});

test("topline comes from Monthly Total columns; blanks stay null", () => {
  const p = parseRows(sheet());
  const aug = p.topline.find((t) => t.month === "2026-08-01")!;
  assert.equal(aug.budget_aud, 108381.33);
  assert.equal(aug.spend_aud, 88133.15);
  assert.equal(aug.lead_target, null);
  const sep = p.topline.find((t) => t.month === "2026-09-01")!;
  assert.equal(sep.budget_aud, null);
});

test("flags Monthly Total ratio rows that SUM weekly ratios", () => {
  const p = parseRows(sheet());
  const w = p.warnings.find((x) => x.severity === "hi");
  assert.ok(w, "expected a ratio-sum warning");
  assert.match(w!.text, /AU Google Ads Aug CTR reads 66%/);
});

test("unknown channel rows are skipped, not filed under the previous channel", () => {
  const p = parseRows(sheet());
  const meta = p.rows.find((r) => r.market_id === "au" && r.channel_id === "meta" && r.week_start === "2026-08-02")!;
  assert.equal(meta.spend, 339.29);
  assert.ok(p.warnings.some((w) => /Paid TikTok/.test(w.text)));
});

test("W1 that starts in the previous month gets the right calendar date", () => {
  const rows = sheet();
  rows[0] = [null, null, 46296]; // 1 Oct 2026
  rows[1] = [null, null, "W1", "W2"];
  rows[2] = [null, null, 27, 4];
  const p = parseRows(rows);
  assert.equal(p.weeks[0].date, "2026-09-27");
  assert.equal(p.weeks[0].month, "2026-10");
  assert.equal(p.weeks[1].date, "2026-10-04");
});

test("round-trips through a real .xlsx file", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet()), "Master Report");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const p = await parseWorkbookBuffer(buf);
  assert.equal(p.weeks.length, 8);
  assert.ok(p.rows.length > 0);
});

test("rejects a workbook without the Master Report tab", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1]]), "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  await assert.rejects(parseWorkbookBuffer(buf), /Master Report/);
});
