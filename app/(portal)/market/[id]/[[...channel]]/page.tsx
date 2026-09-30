import Link from "next/link";
import { notFound } from "next/navigation";
import { Chart } from "@/components/Chart";
import { Delta } from "@/components/Delta";
import { Feed } from "@/components/Feed";
import { Icon } from "@/components/Icon";
import { LocalTime } from "@/components/LocalTime";
import { Updated } from "@/components/Updated";
import { STATUS, TARGETING_FIELDS } from "@/lib/constants";
import { getChanges, getCore, getCreatives, getMe, type Market } from "@/lib/data";
import { fmtDate, latest, money, num, pct, short, todayBrisbane } from "@/lib/format";

export default async function MarketPage({ params }: { params: Promise<{ id: string; channel?: string[] }> }) {
  const { id, channel } = await params;
  const [{ isEditor }, core, changes] = await Promise.all([getMe(), getCore(), getChanges()]);
  const { markets, channels, perf, mc, liveChannels } = core;
  const m = markets.find((x) => x.id === id);
  if (!m) notFound();

  const ordered = [...channels].sort(
    (a, b) => (mc(id, a.id)?.status === "live" ? 0 : 1) - (mc(id, b.id)?.status === "live" ? 0 : 1),
  );
  const requested = channel?.[0];
  const active = requested && channels.some((c) => c.id === requested) ? requested : ordered[0]?.id;
  if (channel && channel.length > 1) notFound();

  const { cur, prev } = perf.months();
  const cids = channels.map((c) => c.id);
  const a = perf.agg(id, cids, cur),
    b = perf.agg(id, cids, prev);
  const W = perf.weeks();
  const pc = perf.perfChannels(id);
  const labels = W.map((w) => fmtDate(w.date));
  const spendBars = pc.map((cid) => {
    const c = channels.find((x) => x.id === cid)!;
    return {
      name: c.name,
      hex: c.hex,
      values: W.map((w) => perf.series(id, cid)?.spend[w.i] || 0),
      fmt: (v: number) => money(v, m.currency),
    };
  });
  const leadsLine = {
    name: "Leads",
    values: W.map((w) => pc.reduce((s, cid) => s + (perf.series(id, cid)?.leads[w.i] || 0), 0)),
    fmt: (v: number) => num(v, 1),
  };
  const best = pc
    .map((cid) => ({ name: channels.find((c) => c.id === cid)!.name, cpl: perf.agg(id, [cid], cur).cpl }))
    .filter((x) => x.cpl)
    .sort((x, y) => x.cpl! - y.cpl!)[0];
  const live = liveChannels(id);
  const marketChanges = changes.filter((c) => c.market_id === id || c.market_id === null).slice(0, 4);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="meta">
            {m.country} · {m.currency} · {m.tz_label} time <LocalTime tz={m.tz} />
          </div>
          <h1 style={{ marginTop: 4 }}>{m.name}</h1>
        </div>
        {isEditor && (
          <Link className="btn ghost" href={`/admin/channels?m=${id}&c=${active}`}>
            Edit {m.code} setup
          </Link>
        )}
      </div>
      {m.note && (
        <div className="note" style={{ marginBottom: 16 }}>
          <Icon name="warn" strokeWidth={2} />
          <div>
            <b>Tracking note.</b> {m.note}
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <small>Spend / week</small>
          <b className="num">{money(a.spendW, m.currency)}</b>
          <Delta cur={a.spendW} prev={b.spendW} neutral />
        </div>
        <div className="kpi">
          <small>Leads / week</small>
          <b className="num">{num(a.leadsW, 1)}</b>
          <Delta cur={a.leadsW} prev={b.leadsW} />
        </div>
        <div className="kpi">
          <small>Cost per lead</small>
          <b className="num">{money(a.cpl, m.currency)}</b>
          <Delta cur={a.cpl} prev={b.cpl} lowerBetter />
        </div>
        <div className="kpi">
          <small>Lowest cost per lead</small>
          <b className="num">{best ? money(best.cpl, m.currency) : "—"}</b>
          <span className="meta">{best ? best.name : "No leads yet"}</span>
        </div>
        <div className="kpi">
          <small>Live channels</small>
          <b className="num">{live.length}</b>
          <span className="meta">{live.map((c) => c.name).join(", ") || "None"}</span>
        </div>
      </div>
      <p className="meta" style={{ margin: "8px 0 0" }}>
        {perf.monthsNote()} · <Updated at={core.perfUpdatedAt} label="Data updated" />
      </p>

      <div className="split mt">
        <section className="panel">
          <div className="panel-head">
            <h2>Weekly spend and leads</h2>
            <span className="meta">{m.currency}</span>
          </div>
          {pc.length ? (
            <Chart labels={labels} bars={spendBars} line={leadsLine} h={240} fmtL={short} title={`${m.name} weekly spend and leads`} />
          ) : (
            <div className="emptybox">
              <b>No spend recorded yet</b>Weekly spend and leads will chart here once Sunny uploads the media report.
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>From the team</h2>
            {m.commentary && <Updated at={m.updated_at} />}
          </div>
          {m.commentary ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.commentary}</p>
          ) : (
            <div className="emptybox">
              <b>Commentary coming</b>Your account team adds a short read on {m.code} performance each month.
            </div>
          )}
          <h3 className="mt2" style={{ marginBottom: 8 }}>
            Recent changes
          </h3>
          <Feed items={marketChanges} markets={markets} channels={channels} />
        </section>
      </div>

      <div className="tabs mt2" role="tablist" aria-label="Channels">
        {ordered.map((c) => {
          const st = mc(id, c.id)?.status ?? "not_live";
          return (
            <Link
              key={c.id}
              role="tab"
              aria-selected={c.id === active}
              className={`tab ${c.id === active ? "on" : ""} ${st === "live" ? "" : "dim"}`}
              href={`/market/${id}/${c.id}`}
              scroll={false}
            >
              <span className={`dot ${st === "live" ? "live" : ""}`} />
              {c.name}
            </Link>
          );
        })}
      </div>
      {active && <ChannelPanel core={core} m={m} cid={active} />}
    </>
  );
}

async function ChannelPanel({ core, m, cid }: { core: Awaited<ReturnType<typeof getCore>>; m: Market; cid: string }) {
  const { channels, perf, mc } = core;
  const c = channels.find((x) => x.id === cid)!;
  const ch = mc(m.id, cid);
  const creatives = await getCreatives(m.id, cid);
  const status = ch?.status ?? "not_live";
  const { cur, prev } = perf.months();
  const W = perf.weeks();
  const hasPerf = perf.hasSpend(m.id, cid);
  const rows = W.map((w) => ({ w, r: perf.weekRow(m.id, cid, w.i) }));
  const a = perf.agg(m.id, [cid], cur),
    b = perf.agg(m.id, [cid], prev);
  const filled = TARGETING_FIELDS.filter(([k]) => ch?.[k]);
  const inProg = perf.inProgressWeek(todayBrisbane());
  const updated = latest(ch?.updated_at, ...creatives.map((x) => x.updated_at));
  const statusBadge = <span className={`badge st-${status}`}>{STATUS[status]}</span>;
  const embedOn = !!(ch?.whatagraph_url && ch.embed && ch.embed_allowed);
  const wag = ch?.whatagraph_url ? (
    <a className="btn ghost sm" href={ch.whatagraph_url} target="_blank" rel="noopener noreferrer">
      Open in Whatagraph <Icon name="ext" size={14} strokeWidth={2} />
    </a>
  ) : (
    <span className="meta">Whatagraph link not added yet</span>
  );

  if (status !== "live" && !hasPerf && !filled.length && !creatives.length) {
    return (
      <section className="panel" role="tabpanel">
        <div className="panel-head">
          <h2>
            {c.name} in {m.code}
          </h2>
          <span className="row" style={{ gap: 10 }}>
            <Updated at={ch?.updated_at} />
            {statusBadge}
          </span>
        </div>
        <div className="emptybox">
          <b>
            {status === "awaiting"
              ? "Tracking for this channel is being set up"
              : status === "planned"
                ? "Planned, not running yet"
                : status === "paused"
                  ? "Paused"
                  : "Not running in this market"}
          </b>
          {ch?.notes || "Targeting, creative and results will appear here once it goes live. Your Sunny team keeps this up to date."}
        </div>
      </section>
    );
  }

  const derivedClicks = rows.some((x) => x.r?.derived);
  const star = (on: boolean) =>
    on ? (
      <sup className="flag" title="Includes clicks estimated from CTR × impressions">
        *
      </sup>
    ) : null;

  return (
    <div role="tabpanel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div className="row">
          <h2>
            {c.name} in {m.code}
          </h2>
          {statusBadge}
          <Updated at={updated} />
        </div>
        {wag}
      </div>
      {ch?.notes && (
        <p className="sub" style={{ margin: "-4px 0 16px" }}>
          {ch.notes}
        </p>
      )}
      {embedOn && (
        <section className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <iframe
            src={ch!.whatagraph_url}
            title={`Whatagraph report: ${c.name} in ${m.code}`}
            style={{ width: "100%", height: 560, border: 0, display: "block" }}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </section>
      )}
      {hasPerf ? (
        <>
          <div className="grid g4">
            <div className="panel" style={{ padding: 16 }}>
              <small className="meta">Spend / week</small>
              <div style={{ fontSize: 21, fontWeight: 700 }} className="num">
                {money(a.spendW, m.currency)}
              </div>
              <Delta cur={a.spendW} prev={b.spendW} neutral />
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <small className="meta">Leads / week</small>
              <div style={{ fontSize: 21, fontWeight: 700 }} className="num">
                {num(a.leadsW, 1)}
              </div>
              <Delta cur={a.leadsW} prev={b.leadsW} />
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <small className="meta">Cost per lead</small>
              <div style={{ fontSize: 21, fontWeight: 700 }} className="num">
                {money(a.cpl, m.currency)}
              </div>
              <Delta cur={a.cpl} prev={b.cpl} lowerBetter />
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <small className="meta">Cost per click</small>
              <div style={{ fontSize: 21, fontWeight: 700 }} className="num">
                {money(a.cpc, m.currency, 2)}
                {star(a.derived || b.derived)}
              </div>
              <Delta cur={a.cpc} prev={b.cpc} lowerBetter />
            </div>
          </div>
          <div className="grid g2 mt">
            <section className="panel">
              <div className="panel-head">
                <h3>Clicks and leads</h3>
              </div>
              <Chart
                labels={W.map((w) => fmtDate(w.date))}
                bars={[
                  {
                    name: derivedClicks ? "Clicks (some estimated)" : "Clicks",
                    hex: c.hex === "#E0E0E0" ? "#C2C2C2" : c.hex,
                    values: rows.map((x) => x.r?.clicks || 0),
                    fmt: (v) => num(v),
                  },
                ]}
                line={{ name: "Leads", values: rows.map((x) => x.r?.leads ?? null), fmt: (v) => num(v, 1) }}
                h={250}
                w={440}
                title="Clicks and leads by week"
              />
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>Cost per click and cost per lead</h3>
                <span className="meta">{m.currency}</span>
              </div>
              <Chart
                labels={W.map((w) => fmtDate(w.date))}
                bars={[{ name: "Cost per click", hex: "#C2C2C2", values: rows.map((x) => x.r?.cpc || 0), fmt: (v) => money(v, m.currency, 2) }]}
                line={{ name: "Cost per lead", values: rows.map((x) => x.r?.cpl ?? null), fmt: (v) => money(v, m.currency) }}
                h={250}
                w={440}
                fmtL={short}
                title="Cost per click and cost per lead by week"
              />
            </section>
          </div>
          <section className="panel mt">
            <div className="panel-head">
              <h3>Week by week</h3>
              <span className="meta">Ratios recalculated from totals</span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th className="r">Spend</th>
                    <th className="r">Impressions</th>
                    <th className="r">Clicks</th>
                    <th className="r">CTR</th>
                    <th className="r">CPC</th>
                    <th className="r">Leads</th>
                    <th className="r">CPL</th>
                    <th className="r">Click → lead</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ w, r }) => (
                    <tr key={w.date}>
                      <td>
                        {fmtDate(w.date)}
                        {inProg === w.date && <span className="inprog">In progress</span>}
                      </td>
                      <td className="r num">{money(r?.spend, m.currency)}</td>
                      <td className="r num">{num(r?.imps)}</td>
                      <td className="r num">
                        {num(r?.clicks)}
                        {r?.derived && (
                          <sup className="flag" title="Estimated from CTR × impressions; clicks cell was blank">
                            *
                          </sup>
                        )}
                      </td>
                      <td className="r num">
                        {pct(r?.ctr)}
                        {star(!!r?.derived)}
                      </td>
                      <td className="r num">
                        {money(r?.cpc, m.currency, 2)}
                        {star(!!r?.derived)}
                      </td>
                      <td className="r num">{num(r?.leads, 1)}</td>
                      <td className="r num">{money(r?.cpl, m.currency)}</td>
                      <td className="r num">
                        {pct(r?.cvr)}
                        {star(!!r?.derived)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(derivedClicks || a.derived || b.derived) && (
              <p className="meta" style={{ margin: "8px 0 0" }}>
                * Clicks estimated from CTR × impressions where the weekly clicks figure wasn&apos;t entered. Figures using an estimate are marked.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="emptybox">
          <b>No results yet</b>Weekly results for this channel appear here once they&apos;re in the media report.
        </div>
      )}

      <div className="grid g2 mt">
        <section className="panel">
          <div className="panel-head">
            <h2>Targeting</h2>
            <Updated at={ch?.updated_at} />
          </div>
          {filled.length ? (
            <dl className="dl">
              {TARGETING_FIELDS.map(([k, l]) => (
                <Frag key={k} dt={l} dd={ch?.[k] || null} />
              ))}
            </dl>
          ) : (
            <div className="emptybox">
              <b>Targeting summary coming</b>Your Sunny team will list audiences, locations, keywords and bidding here.
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Live creative &amp; messaging</h2>
            <span className="meta">
              {creatives.length} item{creatives.length === 1 ? "" : "s"}
            </span>
          </div>
          {creatives.length ? (
            <div className="creative">
              {creatives.map((cr) => {
                const href = cr.signed_url || cr.asset_url;
                return (
                  <div key={cr.id} className="cr">
                    <div className="stage">
                      {cr.funnel_stage || "Funnel stage not set"}
                      {cr.vertical ? ` · ${cr.vertical}` : ""}
                    </div>
                    <h3>{cr.name || "Untitled"}</h3>
                    <p>{cr.message}</p>
                    <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                      <span className={`badge st-${cr.status === "Live" ? "live" : cr.status === "Paused" ? "paused" : "planned"}`}>{cr.status}</span>
                      {href && (
                        <a className="linkbtn" href={href} target="_blank" rel="noopener noreferrer">
                          View asset
                        </a>
                      )}
                    </div>
                    {cr.cta && (
                      <p className="meta" style={{ marginTop: 8 }}>
                        CTA: {cr.cta}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="emptybox">
              <b>Creative coming</b>Your Sunny team will show the live ads and key messages for this channel here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Frag({ dt, dd }: { dt: string; dd: string | null }) {
  return (
    <>
      <dt>{dt}</dt>
      <dd>{dd ?? <span className="nodata">—</span>}</dd>
    </>
  );
}
