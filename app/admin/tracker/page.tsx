import { ActionForm } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { APPROVAL, LIVE_STATUS, VERTICALS } from "@/lib/constants";
import { getTracker } from "@/lib/data";
import { fmtStamp, latest } from "@/lib/format";
import { saveTrackerRow } from "../actions";

export default async function AdminTracker() {
  const rows = await getTracker();
  const requests = rows.filter((r) => r.approval === "Changes requested" && r.feedback);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Creative tracker</h2>
        <Updated at={latest(...rows.map((r) => r.updated_at))} />
      </div>
      <p className="meta" style={{ marginTop: -8 }}>
        Set approval to &ldquo;Awaiting approval&rdquo; to let the client approve or request changes from their view.
      </p>
      {requests.length > 0 && (
        <div className="note" style={{ margin: "12px 0 16px" }}>
          <div>
            <b>Client change requests</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {requests.map((r) => (
                <li key={r.id}>
                  <b>{r.funnel_stage}</b>
                  {r.feedback_at ? ` (${fmtStamp(r.feedback_at)})` : ""}: {r.feedback}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="stack" style={{ gap: 12 }}>
        {rows.map((r) => (
          <ActionForm key={r.id} action={saveTrackerRow} className="crow" submit="Save row">
            <input type="hidden" name="id" value={r.id} />
            <div className="full row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontWeight: 700 }}>{r.funnel_stage}</b>
              <Updated at={r.updated_at} />
            </div>
            {VERTICALS.map(([k, l]) => (
              <label key={k} className="f">
                {l}
                <textarea className="inp" name={k} defaultValue={r[k]} />
              </label>
            ))}
            <label className="f">
              CTA
              <input className="inp" name="cta" defaultValue={r.cta} />
            </label>
            <label className="f">
              Landing page URL
              <input className="inp" name="url" type="url" defaultValue={r.url} placeholder="https://…" />
            </label>
            <label className="f">
              Asset link
              <input className="inp" name="asset_url" type="url" defaultValue={r.asset_url} placeholder="https://…" />
            </label>
            <label className="f">
              Shared with OHQ
              <select className="inp" name="shared" defaultValue={r.shared ? "yes" : "no"}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="f">
              Approval
              <select className="inp" name="approval" defaultValue={r.approval}>
                {APPROVAL.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="f">
              Live status
              <select className="inp" name="live_status" defaultValue={r.live_status}>
                {LIVE_STATUS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="f half">
              Client feedback
              <input className="inp" name="feedback" defaultValue={r.feedback} placeholder="Filled in when the client requests changes" />
            </label>
          </ActionForm>
        ))}
      </div>
    </section>
  );
}
