import { Fragment } from "react";
import { getCore, getTopline } from "@/lib/data";
import { fmtDate, money, monthName, num, pct } from "@/lib/format";
import type { Perf, PerfWeek } from "@/lib/perf";

// The media report, laid out like the "Master Report" tab of the sheet:
// months across (weeks, then a monthly total), markets and channels down.
// Numbers come from Whatagraph; every ratio is recomputed from totals.

type Col = { kind: "week"; w: PerfWeek & { i: number } } | { kind: "month"; month: string; weeks: number[] } | { kind: "total"; weeks: number[] };

interface Sums {
  spend: number | null;
  imps: number | null;
  clicks: number | null;
  leads: number | null;
  sessions: number | null;
  derived: boolean;
}

function sums(perf: Perf, mid: string, cid: string, idx: number[]): Sums {
  const s = perf.series(mid, cid);
  const out: Sums = { spend: null, imps: null, clicks: null, leads: null, sessions: null, derived: false };
  if (!s) return out;
  const add = (k: keyof Omit<Sums, "derived">, v: number | null | undefined) => {
    if (v != null) out[k] = (out[k] ?? 0) + v;
  };
  for (const i of idx) {
    add("spend", s.spend[i]);
    add("imps", s.impressions[i]);
    add("leads", s.leads[i]);
    add("sessions", s.sessions[i]);
    const c = perf.clicksAt(s, i);
    add("clicks", c.v);
    if (c.v != null && c.derived) out.derived = true;
  }
  return out;
}

const ratio = (a: number | null, b: number | null) => (a != null && b ? a / b : null);

type Metric = { label: string; cell: (x: Sums, cur: string) => React.ReactNode };

const PAID: Metric[] = [
  { label: "Spend", cell: (x, cur) => money(x.spend, cur) },
  { label: "Impressions", cell: (x) => num(x.imps) },
  { label: "Clicks", cell: (x) => (x.clicks == null ? "—" : `${num(x.clicks)}${x.derived ? "*" : ""}`) },
  { label: "CTR", cell: (x) => pct(ratio(x.clicks, x.imps)) },
  { label: "CPC", cell: (x, cur) => money(ratio(x.spend, x.clicks), cur, 2) },
  { label: "Leads", cell: (x) => num(x.leads) },
  { label: "Conversion rate", cell: (x) => pct(ratio(x.leads, x.clicks)) },
];
const ORGANIC: Metric[] = [
  { label: "Sessions (GA4)", cell: (x) => num(x.sessions) },
  { label: "Conversions (GA4 key events)", cell: (x) => num(x.leads) },
  { label: "Conversion rate", cell: (x) => pct(ratio(x.leads, x.sessions)) },
];

/** The media report from Whatagraph data, with every ratio recalculated from totals. */
export async function RecalculatedReport({ today }: { today: string }) {
  const [{ markets, channels, perf }, topline] = await Promise.all([getCore(), getTopline()]);

  const weeks = perf.weeks();
  const months = [...new Set(weeks.map((w) => w.month))];
  const cols: Col[] = [];
  for (const m of months) {
    const mw = weeks.filter((w) => w.month === m);
    for (const w of mw) cols.push({ kind: "week", w });
    cols.push({ kind: "month", month: m, weeks: mw.map((w) => w.i) });
  }
  if (months.length) cols.push({ kind: "total", weeks: weeks.map((w) => w.i) });
  const idxOf = (c: Col) => (c.kind === "week" ? [c.w.i] : c.weeks);
  const cls = (c: Col) => (c.kind === "week" ? "r" : "r tot");
  const span = cols.length + 2;
  const inProgress = perf.inProgressWeek(today);

  const top = new Map(topline.map((t) => [t.month.slice(0, 7), t]));
  const topIn = (c: Col) => (c.kind === "month" ? [top.get(c.month)].filter(Boolean) : c.kind === "total" ? months.map((m) => top.get(m)).filter(Boolean) : []) as typeof topline;
  const sumOf = (rows: typeof topline, k: "budget_aud" | "spend_aud" | "lead_target" | "leads_actual") =>
    rows.some((r) => r[k] != null) ? rows.reduce((a, r) => a + (r[k] ?? 0), 0) : null;
  const TOPLINE: { label: string; cell: (rows: typeof topline, c: Col) => string }[] = [
    { label: "Monthly marketing budget (AUD)", cell: (r) => money(sumOf(r, "budget_aud"), "AUD") },
    { label: "Monthly marketing spend (AUD)", cell: (r) => money(sumOf(r, "spend_aud"), "AUD") },
    { label: "Spend %", cell: (r) => pct(ratio(sumOf(r, "spend_aud"), sumOf(r, "budget_aud"))) },
    { label: "Lead target", cell: (r) => num(sumOf(r, "lead_target")) },
    { label: "Leads (actual, minus fraud)", cell: (r) => num(sumOf(r, "leads_actual")) },
    { label: "Lead % change YoY", cell: (r, c) => (c.kind === "month" ? pct(r[0]?.leads_yoy_pct) : "—") },
  ];

  const blocks = markets
    .map((m) => ({ m, chans: channels.filter((c) => perf.series(m.id, c.id)) }))
    .filter((b) => b.chans.length);
  const anyDerived = blocks.some(({ m, chans }) => chans.some((c) => sums(perf, m.id, c.id, weeks.map((w) => w.i)).derived));

  return (
    <>
      {!months.length ? (
        <div className="emptybox">
          <b>No report data yet</b>Weeks appear here once the media report has spend recorded.
        </div>
      ) : (
        <>
          <div className="tbl-wrap report">
            <table>
              <thead>
                <tr>
                  <th className="c1" rowSpan={2}>
                    Channel
                  </th>
                  <th className="c2" rowSpan={2}>
                    Metric
                  </th>
                  {months.map((m) => (
                    <th key={m} className="mh" colSpan={weeks.filter((w) => w.month === m).length + 1}>
                      {monthName(m, true)} {m.slice(0, 4)}
                    </th>
                  ))}
                  <th className="r tot" rowSpan={2}>
                    Total
                  </th>
                </tr>
                <tr>
                  {cols
                    .filter((c) => c.kind !== "total")
                    .map((c) =>
                      c.kind === "week" ? (
                        <th key={c.w.date} className="r">
                          {c.w.label}
                          <small>w/c {fmtDate(c.w.date)}</small>
                          {c.w.date === inProgress && <small className="inprog">in progress</small>}
                        </th>
                      ) : (
                        <th key={`t${c.kind === "month" ? c.month : ""}`} className="r tot">
                          Monthly total
                        </th>
                      ),
                    )}
                </tr>
              </thead>
              <tbody>
                <tr className="sec">
                  <td colSpan={span}>Topline performance across all markets</td>
                </tr>
                {TOPLINE.map((t, j) => (
                  <tr key={t.label}>
                    {j === 0 && (
                      <td className="c1" rowSpan={TOPLINE.length}>
                        Business reporting
                      </td>
                    )}
                    <td className="c2">{t.label}</td>
                    {cols.map((c, k) => (
                      <td key={k} className={cls(c)}>
                        {c.kind === "week" ? "" : t.cell(topIn(c), c)}
                      </td>
                    ))}
                  </tr>
                ))}
                {blocks.map(({ m, chans }) => (
                  <Fragment key={m.id}>
                    <tr className="sec">
                      <td colSpan={span}>
                        {m.name} ({m.currency})
                      </td>
                    </tr>
                    {chans.map((ch) => {
                      const metrics = ch.id === "organic" ? ORGANIC : PAID;
                      const data = cols.map((c) => sums(perf, m.id, ch.id, idxOf(c)));
                      return metrics.map((mt, j) => (
                        <tr key={`${ch.id}:${mt.label}`} className={j === 0 ? "first" : undefined}>
                          {j === 0 && (
                            <td className="c1" rowSpan={metrics.length}>
                              {ch.name}
                            </td>
                          )}
                          <td className="c2">{mt.label}</td>
                          {cols.map((c, k) => (
                            <td key={k} className={cls(c)}>
                              {mt.cell(data[k], m.currency)}
                            </td>
                          ))}
                        </tr>
                      ));
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            From Whatagraph. CTR, CPC and conversion rate are worked out from the totals, so monthly figures aren&apos;t sums of weekly
            percentages. Spend is in each market&apos;s own currency and is never added across markets. Organic &amp; AI search is GA4&apos;s
            Organic Search and AI Assistant channels; its conversions are GA4 key events, not leads.
            {anyDerived && " * Some clicks are estimated from CTR × impressions."}
          </p>
        </>
      )}
    </>
  );
}
