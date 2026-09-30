// Performance maths. Non-negotiables (see brief §5):
// - Every ratio is recomputed from totals. Never sum or average weekly ratios.
// - Month-on-month = weekly averages, current month to date vs previous full month, with week counts.
// - Spend is never added across markets (different currencies). Only leads may be summed.
// - Missing clicks are estimated from the sheet's CTR × impressions, and always flagged.
// - A week is shown only if some market/channel has spend > 0 that week.

export type Measure = "spend" | "impressions" | "clicks" | "leads" | "sessions" | "ctr";
export type Series = Record<Measure, (number | null)[]>;

export interface PerfWeek {
  date: string; // week commencing (Sunday), YYYY-MM-DD
  label: string; // W1..W5
  month: string; // YYYY-MM the sheet assigns this week to
}

export interface PerfData {
  weeks: PerfWeek[];
  markets: Record<string, Record<string, Series>>;
}

export interface PerfRow {
  market_id: string;
  channel_id: string;
  week_start: string;
  report_month: string;
  week_label: string;
  spend: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  leads: number | string | null;
  sessions: number | string | null;
  sheet_ctr: number | string | null;
}

const n = (v: number | string | null | undefined): number | null =>
  v == null || v === "" ? null : Number(v);

/** Build the dense week × market × channel structure from perf_weekly rows. */
export function buildPerf(rows: PerfRow[]): PerfData {
  const byDate = new Map<string, PerfWeek>();
  for (const r of rows) {
    if (!byDate.has(r.week_start))
      byDate.set(r.week_start, { date: r.week_start, label: r.week_label, month: r.report_month.slice(0, 7) });
  }
  const weeks = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const idx = new Map(weeks.map((w, i) => [w.date, i]));
  const markets: PerfData["markets"] = {};
  const empty = (): Series => ({
    spend: weeks.map(() => null),
    impressions: weeks.map(() => null),
    clicks: weeks.map(() => null),
    leads: weeks.map(() => null),
    sessions: weeks.map(() => null),
    ctr: weeks.map(() => null),
  });
  for (const r of rows) {
    const s = ((markets[r.market_id] ??= {})[r.channel_id] ??= empty());
    const i = idx.get(r.week_start)!;
    s.spend[i] = n(r.spend);
    s.impressions[i] = n(r.impressions);
    s.clicks[i] = n(r.clicks);
    s.leads[i] = n(r.leads);
    s.sessions[i] = n(r.sessions);
    s.ctr[i] = n(r.sheet_ctr);
  }
  return { weeks, markets };
}

export interface WeekCalc {
  spend: number | null;
  imps: number | null;
  clicks: number | null;
  leads: number | null;
  derived: boolean; // clicks estimated from CTR × impressions
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cvr: number | null;
}

export interface Agg {
  n: number;
  spend: number;
  imps: number;
  clicks: number;
  leads: number;
  derived: boolean; // any estimated clicks included in the click total
  spendW: number | null;
  leadsW: number | null;
  cpl: number | null;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
}

export type Tone = "up" | "down" | "flat";
export interface Delta {
  tone: Tone;
  text: string;
}

/** Good/bad deltas are green/red. Spend (neutral) is always grey. */
export function delta(
  cur: number | null | undefined,
  prev: number | null | undefined,
  lowerBetter = false,
  neutral = false,
): Delta {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev) || prev === 0) return { tone: "flat", text: "new" };
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.03) return { tone: "flat", text: "flat" };
  const text = `${d > 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(0)}%`;
  if (neutral) return { tone: "flat", text };
  const good = lowerBetter ? d < 0 : d > 0;
  return { tone: good ? "up" : "down", text };
}

export function monthLong(k: string): string {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
}

export class Perf {
  readonly data: PerfData;
  readonly marketIds: string[];
  readonly channelIds: string[];
  private _weeks: (PerfWeek & { i: number })[];

  constructor(data: PerfData, marketIds: string[], channelIds: string[]) {
    this.data = data;
    this.marketIds = marketIds;
    this.channelIds = channelIds;
    this._weeks = data.weeks
      .map((w, i) => ({ ...w, i }))
      .filter((w) =>
        marketIds.some((m) => channelIds.some((c) => (data.markets[m]?.[c]?.spend?.[w.i] || 0) > 0)),
      );
  }

  series(mid: string, cid: string): Series | undefined {
    return this.data.markets[mid]?.[cid];
  }

  /** Weeks included in the portal: some market/channel had spend > 0. */
  weeks() {
    return this._weeks;
  }

  clicksAt(s: Series | undefined, i: number): { v: number | null; derived: boolean } {
    if (!s) return { v: null, derived: false };
    if (s.clicks[i] != null) return { v: s.clicks[i], derived: false };
    if (s.ctr[i] != null && s.impressions[i] != null)
      return { v: Math.round(s.ctr[i]! * s.impressions[i]!), derived: true };
    return { v: null, derived: false };
  }

  weekRow(mid: string, cid: string, i: number): WeekCalc | null {
    const s = this.series(mid, cid);
    if (!s) return null;
    const spend = s.spend[i] ?? null;
    const imps = s.impressions[i] ?? null;
    const leads = s.leads[i] ?? null;
    const { v: clicks, derived } = this.clicksAt(s, i);
    return {
      spend,
      imps,
      clicks,
      leads,
      derived,
      ctr: clicks != null && imps ? clicks / imps : null,
      cpc: clicks ? (spend ?? 0) / clicks : null,
      cpl: leads ? (spend ?? 0) / leads : null,
      cvr: clicks && leads != null ? leads / clicks : null,
    };
  }

  /** Totals for one market across channels, for one reporting month. Ratios from totals. */
  agg(mid: string, cids: string[], monthKey: string | undefined): Agg {
    const W = this._weeks.filter((w) => w.month === monthKey);
    let spend = 0,
      imps = 0,
      clicks = 0,
      leads = 0,
      derived = false;
    const count = W.length;
    for (const w of W)
      for (const cid of cids) {
        const r = this.weekRow(mid, cid, w.i);
        if (!r) continue;
        spend += r.spend || 0;
        imps += r.imps || 0;
        leads += r.leads || 0;
        if (r.clicks != null) {
          clicks += r.clicks;
          if (r.derived) derived = true;
        }
      }
    return {
      n: count,
      spend,
      imps,
      clicks,
      leads,
      derived,
      spendW: count ? spend / count : null,
      leadsW: count ? leads / count : null,
      cpl: leads ? spend / leads : null,
      ctr: imps ? clicks / imps : null,
      cpc: clicks ? spend / clicks : null,
      cvr: clicks ? leads / clicks : null,
    };
  }

  months(): { cur: string | undefined; prev: string | undefined; all: string[] } {
    const ms = [...new Set(this._weeks.map((w) => w.month))];
    return { cur: ms[ms.length - 1], prev: ms[ms.length - 2], all: ms };
  }

  weekCount(month: string | undefined): number {
    return this._weeks.filter((w) => w.month === month).length;
  }

  monthsNote(): string {
    const { cur, prev } = this.months();
    if (!cur) return "No weeks with spend yet";
    const nc = this.weekCount(cur);
    if (!prev) return `${monthLong(cur)} to date (${nc} wk${nc === 1 ? "" : "s"}), weekly averages`;
    const np = this.weekCount(prev);
    return `${monthLong(cur)} to date (${nc} wk${nc === 1 ? "" : "s"}) vs ${monthLong(prev)} (${np} wk${np === 1 ? "" : "s"}), weekly averages`;
  }

  /** Channels in this market with any spend. */
  perfChannels(mid: string): string[] {
    return this.channelIds.filter((c) => this.series(mid, c)?.spend.some((v) => (v ?? 0) > 0));
  }

  hasSpend(mid: string, cid: string): boolean {
    return !!this.series(mid, cid)?.spend.some((v) => (v ?? 0) > 0);
  }

  /** Leads by week for a market, summed over the given channels (leads may be summed). */
  leadsByWeek(mids: string[], cids: string[]): number[] {
    return this._weeks.map((w) =>
      mids.reduce((a, m) => a + cids.reduce((b, c) => b + (this.series(m, c)?.leads[w.i] || 0), 0), 0),
    );
  }

  /** Sum of leads across markets for a month. Spend is deliberately not offered across markets. */
  leadsAcrossMarkets(month: string | undefined, cids = this.channelIds): number {
    return this.marketIds.reduce((a, m) => a + this.agg(m, cids, month).leads, 0);
  }

  /** The week containing `today`, if it is one of the shown weeks (data still coming in). */
  inProgressWeek(today: string): string | null {
    const t = Date.parse(today + "T00:00:00Z");
    const w = this._weeks.find((w) => {
      const s = Date.parse(w.date + "T00:00:00Z");
      return s <= t && t < s + 7 * 864e5;
    });
    return w?.date ?? null;
  }
}
