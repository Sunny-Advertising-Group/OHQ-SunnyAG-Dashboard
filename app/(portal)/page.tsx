import Link from "next/link";
import { Chart, Spark } from "@/components/Chart";
import { Delta } from "@/components/Delta";
import { Feed } from "@/components/Feed";
import { Greeting } from "@/components/Greeting";
import { LinkTile } from "@/components/LinkTile";
import { Updated } from "@/components/Updated";
import { getChanges, getCore, getLinks, getMe, getTopline, type Topline } from "@/lib/data";
import { firstName, fmtDate, latest, money, monthName, num, pct, todayBrisbane } from "@/lib/format";

export default async function HomePage() {
  const [{ profile, isEditor }, core, links, changes, topline] = await Promise.all([
    getMe(),
    getCore(),
    getLinks(),
    getChanges(),
    getTopline(),
  ]);
  const { markets, channels, perf, liveChannels, perfUpdatedAt } = core;
  const W = perf.weeks();
  const labels = W.map((w) => fmtDate(w.date));
  const { cur, prev } = perf.months();
  const mids = markets.map((m) => m.id);
  const paid = channels.filter((c) => c.id !== "organic");
  const inProg = perf.inProgressWeek(todayBrisbane());

  const series = paid
    .filter((c) => markets.some((m) => perf.series(m.id, c.id)?.leads.some((v) => (v ?? 0) > 0)))
    .map((c) => ({ name: c.name, hex: c.hex, values: perf.leadsByWeek(mids, [c.id]), fmt: (v: number) => num(v, 1) }));
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const lastW = W[W.length - 1];
  const lastTotal = totals[totals.length - 1];

  const paidIds = paid.map((c) => c.id);
  const nCur = perf.weekCount(cur),
    nPrev = perf.weekCount(prev);
  const leadsWCur = nCur ? perf.leadsAcrossMarkets(cur, paidIds) / nCur : null;
  const leadsWPrev = nPrev ? perf.leadsAcrossMarkets(prev, paidIds) / nPrev : null;
  const metaShare = (mk: string | undefined) => {
    const t = perf.leadsAcrossMarkets(mk, paidIds);
    return t ? perf.leadsAcrossMarkets(mk, ["meta"]) / t : null;
  };
  const liveCount = markets.reduce((a, m) => a + liveChannels(m.id).length, 0);
  const linksUpdated = latest(...links.map((l) => l.updated_at));

  return (
    <>
      <div className="page-head">
        <div>
          <Greeting name={firstName(profile.name)} />
          <p className="sub">
            {lastW
              ? `Paid media across OfficeHQ and ReceptionHQ, as of the week of ${fmtDate(lastW.date, { day: "numeric", month: "long" })}.`
              : "Paid media across OfficeHQ and ReceptionHQ."}
          </p>
        </div>
        <div className="meta">
          {liveCount} live channel{liveCount === 1 ? "" : "s"} across {markets.length} markets · <Updated at={perfUpdatedAt} label="Data updated" />
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 16, padding: "18px 22px" }}>
        <div className="panel-head" style={{ marginBottom: 12 }}>
          <h2>Quick links</h2>
          <span className="row" style={{ gap: 12 }}>
            <Updated at={linksUpdated} />
            {isEditor && (
              <Link className="linkbtn" href="/admin/links">
                Edit links
              </Link>
            )}
          </span>
        </div>
        {links.length ? (
          <div className="qlinks">
            {links.map((l) => (
              <LinkTile key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="emptybox">
            <b>No links yet</b>Your Sunny team will add links to Whatagraph, the WIP, the flight plan and creative folders here.
          </div>
        )}
      </section>

      {lastW ? (
        <section className="hero">
          <div className="hero-l">
            <div className="meta">
              Paid leads, week of {fmtDate(lastW.date)}
              {inProg === lastW.date && <span className="inprog">In progress</span>}
            </div>
            <div className="hero-big num">
              {num(lastTotal, 0)}
              <span className="unit">leads</span>
            </div>
            <div className="meta">across {markets.map((m) => m.code).join(", ").replace(/, (?=[^,]*$)/, " and ")}</div>
            <div className="rule" />
            <dl className="kv">
              <dt>Leads per week, {cur ? monthName(cur) : "—"}</dt>
              <dd className="num">
                {num(leadsWCur, 1)} <Delta cur={leadsWCur} prev={leadsWPrev} />
              </dd>
              <dt>Leads per week, {prev ? monthName(prev) : "—"}</dt>
              <dd className="num">{num(leadsWPrev, 1)}</dd>
              <dt>Meta share of leads</dt>
              <dd className="num">
                {pct(metaShare(prev), 0)} → {pct(metaShare(cur), 0)}
              </dd>
            </dl>
          </div>
          <div className="hero-r">
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <h2>Weekly paid leads by channel</h2>
              <span className="meta">Leads can be added across markets; spend can&apos;t, so it lives on each market page.</span>
            </div>
            <Chart labels={labels} bars={series} h={250} title="Weekly paid leads by channel, all markets" />
          </div>
        </section>
      ) : (
        <div className="emptybox">
          <b>No performance data yet</b>Weekly results appear here once Sunny uploads the media report.
        </div>
      )}

      <div className="panel-head mt2">
        <h2>Markets</h2>
        <span className="meta">{perf.monthsNote()}</span>
      </div>
      <div className="grid g4">
        {markets.map((m) => {
          const cids = channels.map((c) => c.id);
          const a = perf.agg(m.id, cids, cur),
            b = perf.agg(m.id, cids, prev);
          const live = liveChannels(m.id);
          return (
            <Link key={m.id} className="mcard" href={`/market/${m.id}`}>
              <div className="mcard-top">
                <div>
                  <div className="mcode">{m.code}</div>
                  <div className="mname">
                    {m.name} · {m.currency}
                  </div>
                </div>
                <Spark values={perf.leadsByWeek([m.id], cids)} />
              </div>
              <div className="mstats">
                <div className="mstat">
                  <small>Leads / week</small>
                  <b className="num">{num(a.leadsW, 1)}</b>
                  <br />
                  <Delta cur={a.leadsW} prev={b.leadsW} />
                </div>
                <div className="mstat">
                  <small>Cost per lead</small>
                  <b className="num">{money(a.cpl, m.currency)}</b>
                  <br />
                  <Delta cur={a.cpl} prev={b.cpl} lowerBetter />
                </div>
              </div>
              <div className="chips">
                {live.length ? (
                  live.map((c) => (
                    <span key={c.id} className="chip live">
                      {c.name}
                    </span>
                  ))
                ) : (
                  <span className="chip">No live channels</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="split mt2">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Month-on-month by channel</h2>
              <span className="meta">Weekly averages, local currency</span>
            </div>
            <MomTable core={core} cur={cur} prev={prev} />
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>What&apos;s changed</h2>
              <span className="row" style={{ gap: 12 }}>
                <Updated at={changes[0]?.created_at} />
                {isEditor && (
                  <Link className="linkbtn" href="/admin/changes">
                    Add update
                  </Link>
                )}
              </span>
            </div>
            <Feed items={changes.slice(0, 6)} markets={markets} channels={channels} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Budget pacing</h2>
              <span className="meta">All businesses, AUD</span>
            </div>
            <Pacing topline={topline} />
          </section>
        </div>
      </div>
    </>
  );
}

function MomTable({
  core,
  cur,
  prev,
}: {
  core: Awaited<ReturnType<typeof getCore>>;
  cur: string | undefined;
  prev: string | undefined;
}) {
  const { markets, channels, perf } = core;
  const rows = markets.flatMap((m) =>
    perf.perfChannels(m.id).map((cid) => {
      const c = channels.find((x) => x.id === cid)!;
      const a = perf.agg(m.id, [cid], cur),
        b = perf.agg(m.id, [cid], prev);
      return (
        <tr key={`${m.id}:${cid}`}>
          <td>
            <b style={{ fontWeight: 700 }}>{m.code}</b> {c.name}
          </td>
          <td className="r num">
            {money(a.spendW, m.currency)} <Delta cur={a.spendW} prev={b.spendW} neutral />
          </td>
          <td className="r num">
            {num(a.leadsW, 1)} <Delta cur={a.leadsW} prev={b.leadsW} />
          </td>
          <td className="r num">
            {money(a.cpl, m.currency)} <Delta cur={a.cpl} prev={b.cpl} lowerBetter />
          </td>
        </tr>
      );
    }),
  );
  if (!rows.length)
    return (
      <div className="emptybox">
        <b>No spend recorded yet</b>Each market and channel with spend will be compared here once Sunny uploads the media report.
      </div>
    );
  return (
    <>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Market &amp; channel</th>
              <th className="r">Spend / wk</th>
              <th className="r">Leads / wk</th>
              <th className="r">Cost per lead</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <p className="meta" style={{ margin: "10px 0 0" }}>
        {perf.monthsNote()}. Green means better: more leads or a lower cost per lead. Spend changes are shown in grey.
      </p>
    </>
  );
}

function Pacing({ topline }: { topline: Topline[] }) {
  if (!topline.length)
    return (
      <div className="emptybox">
        <b>Budget pacing coming</b>Monthly budget and spend appear here once they&apos;re in the media report.
      </div>
    );
  return (
    <>
      {topline.map((t) => {
        const mk = t.month.slice(0, 7);
        const b = t.budget_aud,
          s = t.spend_aud;
        if (!b && !s)
          return (
            <div key={mk} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }} className="row">
              <b style={{ width: 44, fontWeight: 600 }}>{monthName(mk)}</b>
              <span className="meta">Not entered</span>
            </div>
          );
        const p = b ? (s ?? 0) / b : null;
        return (
          <div key={mk} style={{ padding: "10px 0 12px" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontWeight: 600 }}>{monthName(mk, true)}</b>
              <span className="num">
                <b style={{ fontWeight: 700 }}>{money(s, "AUD")}</b> <span className="meta">of {b ? money(b, "AUD") : "budget not entered"}</span>
              </span>
            </div>
            <div
              style={{ height: 10, borderRadius: 5, background: "var(--bg)", border: "1px solid var(--line)", marginTop: 8, overflow: "hidden" }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(100, (p || 0) * 100))}
              aria-label={`${monthName(mk, true)} budget spent`}
            >
              <div style={{ height: "100%", width: `${Math.min(100, (p || 0) * 100)}%`, background: "var(--gold)" }} />
            </div>
            <div className="meta" style={{ marginTop: 6 }}>
              {pct(p, 0)} of budget spent
            </div>
          </div>
        );
      })}
      <p className="meta" style={{ margin: "4px 0 0" }}>
        Covers OHQ, RHQ ×3, ANS &amp; LexHelper. <Updated at={latest(...topline.map((t) => t.updated_at))} />
      </p>
    </>
  );
}
