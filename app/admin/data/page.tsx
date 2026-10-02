import { ActionForm } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { dataChecks } from "@/lib/checks";
import { getCore, getSetting, getTopline } from "@/lib/data";
import { fmtDate, monthName, todayBrisbane } from "@/lib/format";
import { readServiceAccount } from "@/lib/google";
import { SHEET_ID, type SyncStatus } from "@/lib/sheet-sync";
import { WG_SOURCES, type WgSyncStatus } from "@/lib/whatagraph";
import { saveTopline } from "../actions";
import { SyncNowButton } from "./SheetSync";

const parse = <T,>(v: string): T | null => {
  try {
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

const when = (ts?: string) =>
  ts ? new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }) : "—";

/** "2026-09" for the current month and every month that has data or a topline row. */
function monthList(weeks: { month: string }[], topline: { month: string }[], today: string) {
  const set = new Set<string>([...weeks.map((w) => w.month), ...topline.map((t) => t.month.slice(0, 7)), today.slice(0, 7)]);
  return [...set].sort().reverse();
}

export default async function AdminData() {
  const [{ perf, markets, channels, perfUpdatedAt }, topline, wgRaw, sheetRaw] = await Promise.all([
    getCore(),
    getTopline(),
    getSetting("whatagraph_sync"),
    getSetting("sheet_sync"),
  ]);
  const wg = parse<WgSyncStatus>(wgRaw.value);
  const sheet = parse<SyncStatus>(sheetRaw.value);
  const { sa, problem: keyProblem } = readServiceAccount();
  const today = todayBrisbane();
  const checks = dataChecks({ perf, markets, channels, topline, importWarnings: [], today });
  const W = perf.weeks();
  const last = W[W.length - 1];
  const months = monthList(W, topline, today);
  const top = new Map(topline.map((t) => [t.month.slice(0, 7), t]));
  const mName = new Map(markets.map((m) => [m.id, m.code]));
  const cName = new Map(channels.map((c) => [c.id, c.name]));
  const v = (n: number | null | undefined, scale = 1) => (n == null ? "" : String(Math.round(n * scale * 100) / 100));

  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Whatagraph</h2>
            <Updated at={perfUpdatedAt} label="Data updated" />
          </div>
          <p style={{ margin: "0 0 10px" }}>
            Every performance number in the portal comes from Whatagraph. A Claude routine pulls each connected account once a day (about
            6am Brisbane), adds it up by Sunday–Saturday week and loads it here. Ratios are worked out from the totals.
          </p>
          {wg ? (
            <dl className="kv" style={{ marginBottom: 12 }}>
              <dt>Last run</dt>
              <dd>{when(wg.at)} (Brisbane)</dd>
              <dt>Result</dt>
              <dd className={wg.ok ? "" : "err-msg"} style={{ textAlign: "right" }}>
                {wg.ok
                  ? `${wg.rows} market × channel weeks checked, ${wg.changed} updated${wg.removed ? `, ${wg.removed} removed` : ""}.${
                      wg.marked_live ? ` ${wg.marked_live} channel${wg.marked_live === 1 ? "" : "s"} marked live.` : ""
                    }${wg.marked_not_live ? ` ${wg.marked_not_live} marked not live (no spend in 4 weeks).` : ""}`
                  : wg.message}
              </dd>
              {wg.note && (
                <>
                  <dt>Note</dt>
                  <dd style={{ textAlign: "right" }}>{wg.note}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="meta">Hasn&apos;t run yet.</p>
          )}
          <p className="meta" style={{ margin: "0 0 10px" }}>
            {last
              ? `Data runs to the week of ${fmtDate(last.date, { day: "numeric", month: "long", year: "numeric" })} · ${W.length} weeks with spend.`
              : "No performance data yet."}
          </p>
          <details>
            <summary className="meta">Connected accounts ({WG_SOURCES.length})</summary>
            <div className="tbl-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Channel</th>
                    <th>Whatagraph</th>
                    <th>Counted as leads</th>
                  </tr>
                </thead>
                <tbody>
                  {WG_SOURCES.map((s) => (
                    <tr key={s.sourceId}>
                      <td>{mName.get(s.market) ?? s.market.toUpperCase()}</td>
                      <td>{cName.get(s.channel) ?? s.channel}</td>
                      <td>
                        {s.integration} <span className="meta">#{s.sourceId}</span>
                      </td>
                      <td>{s.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="meta" style={{ margin: "8px 0 0" }}>
              Anything not listed isn&apos;t connected in Whatagraph, so it shows as not live. Connect the account in Whatagraph and ask Claude to add
              it to the routine.
            </p>
          </details>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Business reporting</h2>
            <Updated at={topline.length ? topline.map((t) => t.updated_at).sort().pop()! : null} />
          </div>
          <p className="meta" style={{ margin: "0 0 12px" }}>
            Entered by hand. Shown at the top of Reporting. Leave a month blank to clear it. Spend % is worked out from spend ÷ budget.
          </p>
          <div className="stack" style={{ gap: 14 }}>
            {months.map((m) => {
              const t = top.get(m);
              return (
                <ActionForm key={m} action={saveTopline} className="topline-row" submit="Save">
                  <input type="hidden" name="month" value={m} />
                  <b className="topline-month">
                    {monthName(m, true)} {m.slice(0, 4)}
                  </b>
                  <label className="f">
                    Budget (AUD)
                    <input className="inp" name="budget_aud" inputMode="decimal" defaultValue={v(t?.budget_aud)} />
                  </label>
                  <label className="f">
                    Spend (AUD)
                    <input className="inp" name="spend_aud" inputMode="decimal" defaultValue={v(t?.spend_aud)} />
                  </label>
                  <label className="f">
                    Lead target
                    <input className="inp" name="lead_target" inputMode="decimal" defaultValue={v(t?.lead_target)} />
                  </label>
                  <label className="f">
                    Leads (actual, minus fraud)
                    <input className="inp" name="leads_actual" inputMode="decimal" defaultValue={v(t?.leads_actual)} />
                  </label>
                  <label className="f">
                    Lead % change YoY
                    <input className="inp" name="leads_yoy_pct" inputMode="decimal" placeholder="e.g. 12 or -5" defaultValue={v(t?.leads_yoy_pct, 100)} />
                  </label>
                </ActionForm>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Google Sheet copy</h2>
            <span className="meta">Refreshed every hour</span>
          </div>
          <p style={{ margin: "0 0 10px" }}>
            Reporting also has a read-only copy of the{" "}
            <a className="linkbtn" href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`} target="_blank" rel="noopener noreferrer">
              OfficeHQ Media Report &amp; Tracker
            </a>{" "}
            tab, for comparison. None of its numbers feed the portal.
          </p>
          {sheet && (
            <dl className="kv" style={{ marginBottom: 12 }}>
              <dt>Last checked</dt>
              <dd>{when(sheet.at)} (Brisbane)</dd>
              <dt>Result</dt>
              <dd className={sheet.ok ? "" : "err-msg"} style={{ textAlign: "right" }}>
                {sheet.message}
              </dd>
            </dl>
          )}
          {!sa ? (
            <div className="note" style={{ marginBottom: 12 }}>
              <div>
                <b>Not connected.</b> {keyProblem}
              </div>
            </div>
          ) : (
            <p className="meta" style={{ margin: "0 0 10px" }}>
              Reads the sheet as <b>{sa.client_email}</b>. The sheet must be shared with this address.
            </p>
          )}
          <SyncNowButton />
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Data checks</h2>
          <span className="meta">Only visible to Sunny</span>
        </div>
        {checks.length ? (
          <ul className="checks">
            {checks.map((c, i) => (
              <li key={i}>
                <span className={`sev ${c.severity}`}>{c.severity === "hi" ? "Fix" : c.severity === "md" ? "Check" : "Note"}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No issues found in the current data.</p>
        )}
      </section>
    </div>
  );
}
