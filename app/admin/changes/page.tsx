import { ActionForm, DeleteButton } from "@/components/ActionForm";
import { CHANGE_TYPES } from "@/lib/constants";
import { getChanges, getCore } from "@/lib/data";
import { fmtDate, todayBrisbane } from "@/lib/format";
import { addChange, deleteChange } from "../actions";

export default async function AdminChanges({ searchParams }: { searchParams: Promise<{ m?: string; c?: string }> }) {
  const sp = await searchParams;
  const [{ markets, channels }, changes] = await Promise.all([getCore(), getChanges()]);
  return (
    <div className="split">
      <section className="panel">
        <div className="panel-head">
          <h2>Updates</h2>
          <span className="meta">Client-facing. The latest 6 show on the Overview.</span>
        </div>
        {changes.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Update</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(c.date, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      {c.text}
                      <div className="meta">
                        {c.type} · {c.market_id ? c.market_id.toUpperCase() : "All markets"}
                        {c.channel_id ? ` · ${channels.find((x) => x.id === c.channel_id)?.name ?? ""}` : ""}
                      </div>
                    </td>
                    <td>
                      <DeleteButton action={deleteChange} id={c.id} label="Delete" confirm="Delete this update? The client will no longer see it." />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptybox">No updates yet.</div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Add an update</h2>
        </div>
        <ActionForm action={addChange} className="stack" style={{ gap: 12 }} submit="Publish update" submitClass="btn gold" resetOnSuccess>
          <label className="f">
            Date
            <input className="inp" type="date" name="date" defaultValue={todayBrisbane()} />
          </label>
          <label className="f">
            Market
            <select className="inp" name="market_id" defaultValue={sp.m ?? "all"}>
              <option value="all">All markets</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Channel
            <select className="inp" name="channel_id" defaultValue={sp.c ?? "all"}>
              <option value="all">All channels</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Type
            <select className="inp" name="type" defaultValue="Targeting">
              {CHANGE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="f">
            What changed and why
            <textarea className="inp" name="text" required placeholder="One or two sentences the client will read." />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
