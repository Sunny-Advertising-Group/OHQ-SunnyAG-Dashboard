import { ActionForm } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { getCore } from "@/lib/data";
import { saveMarketText } from "../actions";

export default async function AdminCommentary() {
  const { markets } = await getCore();
  return (
    <div className="grid g2">
      {markets.map((m) => (
        <section key={m.id} className="panel">
          <div className="panel-head">
            <h2>{m.name}</h2>
            <Updated at={m.updated_at} />
          </div>
          <ActionForm action={saveMarketText} className="stack" style={{ gap: 12 }} submit="Save">
            <input type="hidden" name="id" value={m.id} />
            <label className="f">
              Monthly commentary (shown on the market page)
              <textarea
                className="inp"
                name="commentary"
                defaultValue={m.commentary}
                placeholder="Two or three sentences: what happened, why, what we're doing next."
              />
            </label>
            <label className="f">
              Tracking or market note (highlighted banner)
              <textarea className="inp" name="note" defaultValue={m.note} />
            </label>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
