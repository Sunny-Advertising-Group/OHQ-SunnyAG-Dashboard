import Link from "next/link";
import { ActionForm, DeleteButton } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { CREATIVE_STATUS, FUNNEL, STATUS, TARGETING_FIELDS, VERTICALS } from "@/lib/constants";
import { getCore, getCreatives, type Creative } from "@/lib/data";
import { deleteCreative, saveCreative, saveMarketChannel } from "../actions";

export default async function AdminChannels({ searchParams }: { searchParams: Promise<{ m?: string; c?: string }> }) {
  const sp = await searchParams;
  const { markets, channels, mc } = await getCore();
  const m = markets.find((x) => x.id === sp.m) ?? markets[0];
  const c = channels.find((x) => x.id === sp.c) ?? channels[0];
  const ch = mc(m.id, c.id);
  const creatives = await getCreatives(m.id, c.id);
  const formKey = `${m.id}:${c.id}`;

  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 18 }}>
        {markets.map((x) => (
          <Link key={x.id} className={`pill ${x.id === m.id ? "on" : ""}`} href={`/admin/channels?m=${x.id}&c=${c.id}`}>
            {x.code}
          </Link>
        ))}
        <span style={{ width: 12 }} />
        {channels.map((x) => (
          <Link key={x.id} className={`pill ${x.id === c.id ? "on" : ""}`} href={`/admin/channels?m=${m.id}&c=${x.id}`}>
            {x.name}
          </Link>
        ))}
      </div>
      <div className="panel-head">
        <h2>
          {c.name} in {m.code}
        </h2>
        <Updated at={ch?.updated_at} />
      </div>

      <ActionForm key={formKey} action={saveMarketChannel} submit="Save channel" submitClass="btn gold sm">
        <input type="hidden" name="market_id" value={m.id} />
        <input type="hidden" name="channel_id" value={c.id} />
        <div className="fgrid">
          <label className="f">
            Status
            <select className="inp" name="status" defaultValue={ch?.status ?? "not_live"}>
              {Object.entries(STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Whatagraph report link
            <input className="inp" name="whatagraph_url" type="url" defaultValue={ch?.whatagraph_url} placeholder="https://app.whatagraph.com/…" />
          </label>
          <div className="f full">
            {ch?.whatagraph_url && ch.embed_allowed === true ? (
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" name="embed" defaultChecked={ch.embed} /> Also show the Whatagraph report inside the page (the client
                still gets &ldquo;Open in Whatagraph&rdquo;)
              </label>
            ) : (
              <span className="meta">
                {!ch?.whatagraph_url
                  ? "Add a Whatagraph share link. The client sees an “Open in Whatagraph” button."
                  : ch.embed_allowed === false
                    ? "Whatagraph doesn't allow this link to be embedded, so the client gets the “Open in Whatagraph” button only."
                    : "Embedding hasn't been checked yet. Save again to re-test."}
              </span>
            )}
          </div>
          <label className="f full">
            Channel note shown to client
            <textarea className="inp" name="notes" defaultValue={ch?.notes} placeholder="e.g. Launching 14 Oct pending creative approval" />
          </label>
        </div>
        <h3 className="mt2" style={{ marginBottom: 10 }}>
          Targeting
        </h3>
        <div className="fgrid" style={{ marginBottom: 14 }}>
          {TARGETING_FIELDS.map(([k, l]) => (
            <label key={k} className="f">
              {l}
              <textarea className="inp" name={k} defaultValue={ch?.[k]} />
            </label>
          ))}
        </div>
      </ActionForm>

      <div className="row mt2" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <h3>Live creative &amp; messaging</h3>
        <span className="meta">
          {creatives.length} item{creatives.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {creatives.length ? (
          creatives.map((cr) => (
            <div key={cr.id} className="stack" style={{ gap: 6 }}>
              <ActionForm action={saveCreative} className="crow" submit="Save creative">
                <CreativeFields cr={cr} mid={m.id} cid={c.id} />
              </ActionForm>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <DeleteButton action={deleteCreative} id={cr.id} confirm={`Remove "${cr.name || "this creative"}"?`} />
              </div>
            </div>
          ))
        ) : (
          <div className="emptybox">No creative added for this channel yet.</div>
        )}
      </div>
      <h3 className="mt2" style={{ marginBottom: 10 }}>
        Add creative
      </h3>
      <ActionForm action={saveCreative} className="crow" submit="Add creative" submitClass="btn gold sm" resetOnSuccess>
        <CreativeFields mid={m.id} cid={c.id} />
      </ActionForm>

      <div className="row mt2">
        <Link className="btn ghost" href={`/market/${m.id}/${c.id}`}>
          Preview client view
        </Link>
        <Link className="btn gold" href={`/admin/changes?m=${m.id}&c=${c.id}`}>
          Log this change in What&apos;s changed
        </Link>
      </div>
    </section>
  );
}

function CreativeFields({ cr, mid, cid }: { cr?: Creative; mid: string; cid: string }) {
  return (
    <>
      {cr && <input type="hidden" name="id" value={cr.id} />}
      <input type="hidden" name="market_id" value={mid} />
      <input type="hidden" name="channel_id" value={cid} />
      <label className="f half">
        Name
        <input className="inp" name="name" defaultValue={cr?.name} placeholder={'e.g. "Never miss a call" static'} />
      </label>
      <label className="f">
        Funnel stage
        <select className="inp" name="funnel_stage" defaultValue={cr?.funnel_stage ?? ""}>
          <option value="">Not set</option>
          {FUNNEL.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="f">
        Vertical
        <select className="inp" name="vertical" defaultValue={cr?.vertical ?? ""}>
          <option value="">Not set</option>
          {VERTICALS.map(([, l]) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label className="f full">
        Message
        <textarea className="inp" name="message" defaultValue={cr?.message} />
      </label>
      <label className="f">
        CTA
        <input className="inp" name="cta" defaultValue={cr?.cta} />
      </label>
      <label className="f">
        Asset link
        <input className="inp" name="asset_url" type="url" defaultValue={cr?.asset_url} placeholder="https://…" />
      </label>
      <label className="f">
        Or upload the asset (under 4MB)
        <input className="inp" name="asset_file" type="file" accept="image/*,video/*,application/pdf" />
      </label>
      <label className="f">
        Status
        <select className="inp" name="status" defaultValue={cr?.status ?? "Live"}>
          {CREATIVE_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {cr?.asset_path && (
        <div className="f full">
          <span className="row" style={{ gap: 10 }}>
            {cr.signed_url && (
              <a className="linkbtn" href={cr.signed_url} target="_blank" rel="noopener noreferrer">
                View uploaded file
              </a>
            )}
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" name="remove_file" /> Remove uploaded file
            </label>
          </span>
        </div>
      )}
    </>
  );
}
