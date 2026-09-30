import Link from "next/link";
import { Updated } from "@/components/Updated";
import { VERTICALS } from "@/lib/constants";
import { getMe, getTracker } from "@/lib/data";
import { latest } from "@/lib/format";
import { TrackerActions } from "./TrackerActions";

const approvalClass = (s: string) =>
  s === "Approved" ? "st-live" : s === "Changes requested" ? "st-paused" : s === "Awaiting approval" ? "st-planned" : "st-not_live";
const liveClass = (s: string) => (s === "Live" ? "st-live" : s === "Scheduled" ? "st-planned" : s === "Paused" ? "st-paused" : "st-not_live");

export default async function CreativePage() {
  const [{ isEditor }, rows] = await Promise.all([getMe(), getTracker()]);
  const filled = rows.some((r) => VERTICALS.some(([k]) => r[k]) || r.cta);
  const waiting = rows.filter((r) => r.approval === "Awaiting approval").length;
  const empty = <span className="empty-cell">—</span>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Creative tracker</h1>
          <p className="sub">
            Messaging by funnel stage and vertical, with approval and live status. Approve anything waiting on you directly from here.
          </p>
        </div>
        <span className="row" style={{ gap: 12 }}>
          <Updated at={latest(...rows.map((r) => r.updated_at))} />
          {isEditor && (
            <Link className="btn ghost" href="/admin/tracker">
              Edit tracker
            </Link>
          )}
        </span>
      </div>
      {!isEditor && waiting > 0 && (
        <div className="note" style={{ marginBottom: 16 }}>
          <div>
            <b>
              {waiting} item{waiting === 1 ? " is" : "s are"} waiting for your approval.
            </b>
          </div>
        </div>
      )}
      {!filled && (
        <div className="emptybox" style={{ marginBottom: 16 }}>
          <b>Messaging is being loaded in</b>The structure below matches your tracker. Your Sunny team adds copy for each stage and vertical as it&apos;s
          written.
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Funnel stage</th>
              {VERTICALS.map(([, l]) => (
                <th key={l}>{l}</th>
              ))}
              <th>CTA</th>
              <th>Asset</th>
              <th>Shared with OHQ</th>
              <th>Approval</th>
              <th>Live</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <b style={{ fontWeight: 600 }}>{r.funnel_stage}</b>
                </td>
                {VERTICALS.map(([k]) => (
                  <td key={k} style={{ minWidth: 150, whiteSpace: "pre-wrap" }}>
                    {r[k] || empty}
                  </td>
                ))}
                <td>{r.cta || empty}</td>
                <td>
                  {r.asset_url ? (
                    <a className="linkbtn" href={r.asset_url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  ) : (
                    empty
                  )}
                  {r.url && (
                    <>
                      <br />
                      <a className="linkbtn" href={r.url} target="_blank" rel="noopener noreferrer">
                        Landing page
                      </a>
                    </>
                  )}
                </td>
                <td>{r.shared ? "Yes" : "No"}</td>
                <td>
                  <span className={`badge ${approvalClass(r.approval)}`}>{r.approval}</span>
                  {r.feedback && r.approval === "Changes requested" && (
                    <div className="meta" style={{ marginTop: 6, maxWidth: 220 }}>
                      {r.feedback}
                    </div>
                  )}
                  {!isEditor && r.approval === "Awaiting approval" && <TrackerActions rowId={r.id} stage={r.funnel_stage} />}
                </td>
                <td>
                  <span className={`badge ${liveClass(r.live_status)}`}>{r.live_status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
