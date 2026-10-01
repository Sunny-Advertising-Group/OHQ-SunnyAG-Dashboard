import { Updated } from "@/components/Updated";
import { dataChecks, type Check } from "@/lib/checks";
import { getCore, getTopline } from "@/lib/data";
import { fmtDate, fmtStamp, todayBrisbane } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ImportPanel } from "./ImportPanel";
import { SyncNowButton } from "./SheetSync";
import { getSetting } from "@/lib/data";
import { SHEET_ID, type SyncStatus } from "@/lib/sheet-sync";
import { readServiceAccount } from "@/lib/google";

export default async function AdminData() {
  const supabase = await createClient();
  const [{ perf, markets, channels, perfUpdatedAt, perfSource }, topline, { data: imports }] = await Promise.all([
    getCore(),
    getTopline(),
    supabase.from("imports").select("id,file_name,weeks_imported,imported_at,warnings,imported_by").order("imported_at", { ascending: false }).limit(10),
  ]);
  const latest = imports?.[0];
  const syncRaw = await getSetting("sheet_sync");
  let sync: SyncStatus | null = null;
  try {
    sync = syncRaw.value ? (JSON.parse(syncRaw.value) as SyncStatus) : null;
  } catch {}
  const { sa, problem: keyProblem } = readServiceAccount();
  const configured = !!sa && !!process.env.CRON_SECRET;
  const when = (ts?: string) =>
    ts ? new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }) : "—";
  // Checks that only the sheet can reveal (ratio rows summed, unknown channels) come from the latest import.
  const fromSheet = ((latest?.warnings ?? []) as Check[]).filter((w) => /Monthly Total|isn't recognised|seeded/i.test(w.text));
  const checks = dataChecks({ perf, markets, channels, topline, importWarnings: fromSheet, today: todayBrisbane() });
  const W = perf.weeks();
  const last = W[W.length - 1];

  const { data: people } = await supabase.from("profiles").select("id,name,email");
  const who = new Map((people ?? []).map((p) => [p.id, p.name || p.email]));

  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Google Sheet sync</h2>
            <span className="meta">Every hour, on the hour</span>
          </div>
          <p style={{ margin: "0 0 10px" }}>
            Source:{" "}
            <a className="linkbtn" href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`} target="_blank" rel="noopener noreferrer">
              OfficeHQ - Media Report &amp; Tracker 2026
            </a>{" "}
            (Master Report tab)
          </p>
          {sync ? (
            <dl className="kv" style={{ marginBottom: 12 }}>
              <dt>Last checked</dt>
              <dd>{when(sync.at)} (Brisbane)</dd>
              <dt>Result</dt>
              <dd className={sync.ok ? "" : "err-msg"} style={{ textAlign: "right" }}>
                {sync.message}
              </dd>
              {sync.report && (
                <>
                  <dt>Media report tab</dt>
                  <dd className={sync.report.ok ? "" : "err-msg"} style={{ textAlign: "right" }}>
                    {sync.report.message}
                  </dd>
                </>
              )}
              {sync.sheetModified && (
                <>
                  <dt>Sheet last edited</dt>
                  <dd>{when(sync.sheetModified)}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="meta">Hasn&apos;t run yet.</p>
          )}
          {!configured && (
            <div className="note" style={{ marginBottom: 12 }}>
              <div>
                <b>Not connected yet.</b>{" "}
                {!sa
                  ? keyProblem
                  : "CRON_SECRET isn't set in Vercel, so the hourly run is off. Sync now still works."}
              </div>
            </div>
          )}
          {sa && (
            <p className="meta" style={{ margin: "0 0 10px" }}>
              Reads the sheet as <b>{sa.client_email}</b>. The sheet must be shared with this address.
            </p>
          )}
          <SyncNowButton />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Or upload a file</h2>
            <Updated at={perfUpdatedAt} label="Data updated" />
          </div>
          <ImportPanel />
          <p className="meta" style={{ marginTop: 12 }}>
            {last
              ? `Portal data runs to the week of ${fmtDate(last.date, { day: "numeric", month: "long", year: "numeric" })} · ${W.length} weeks with spend · from ${perfSource}`
              : "No performance data yet."}
          </p>
          <p className="meta" style={{ margin: 0 }}>
            Rows are matched by market, channel and week. Blank cells stay blank (never 0). Only spend, impressions, clicks, leads and sessions are
            imported; the portal recalculates every ratio.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Import history</h2>
          </div>
          {imports?.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>File</th>
                    <th>By</th>
                    <th className="r">Weeks</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((i) => (
                    <tr key={i.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtStamp(i.imported_at, true)}</td>
                      <td>{i.file_name}</td>
                      <td>{i.imported_by ? (who.get(i.imported_by) ?? "Removed user") : "Initial setup"}</td>
                      <td className="r num">{i.weeks_imported}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptybox">No imports yet.</div>
          )}
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
