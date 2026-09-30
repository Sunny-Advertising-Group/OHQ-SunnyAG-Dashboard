import { ActionForm, DeleteButton } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { LINK_ICONS } from "@/lib/constants";
import { getLinks } from "@/lib/data";
import { latest } from "@/lib/format";
import { deleteLink, saveLink } from "../actions";

const ICON_LABEL: Record<string, string> = { chart: "Chart", sheet: "Spreadsheet", cal: "Calendar", folder: "Folder", link: "Link" };

function LinkFields({ l }: { l?: { id: string; label: string; url: string; description: string; icon: string; sort: number } }) {
  return (
    <>
      {l && <input type="hidden" name="id" value={l.id} />}
      <label className="f">
        Label
        <input className="inp" name="label" defaultValue={l?.label} placeholder="e.g. Flight plan" required />
      </label>
      <label className="f">
        Link
        <input className="inp" name="url" type="url" defaultValue={l?.url} placeholder="https://…" />
      </label>
      <label className="f half">
        Short description
        <input className="inp" name="description" defaultValue={l?.description} />
      </label>
      <label className="f">
        Icon
        <select className="inp" name="icon" defaultValue={l?.icon ?? "link"}>
          {LINK_ICONS.map((i) => (
            <option key={i} value={i}>
              {ICON_LABEL[i]}
            </option>
          ))}
        </select>
      </label>
      <label className="f">
        Order
        <input className="inp" name="sort" type="number" defaultValue={l?.sort ?? 99} />
      </label>
    </>
  );
}

export default async function AdminLinks() {
  const links = await getLinks();
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Quick links</h2>
        <Updated at={latest(...links.map((l) => l.updated_at))} />
      </div>
      <p className="meta" style={{ marginTop: -8 }}>
        Shown at the top of the Overview. A link with no URL shows as &ldquo;Link not added yet&rdquo;.
      </p>
      <div className="stack" style={{ gap: 12 }}>
        {links.map((l) => (
          <div key={l.id} className="stack" style={{ gap: 6 }}>
            <ActionForm action={saveLink} className="crow" submit="Save">
              <LinkFields l={l} />
            </ActionForm>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <DeleteButton action={deleteLink} id={l.id} confirm={`Remove "${l.label}" from the quick links?`} />
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt2" style={{ marginBottom: 10 }}>
        Add a link
      </h3>
      <ActionForm action={saveLink} className="crow" submit="Add link" submitClass="btn gold sm" resetOnSuccess>
        <LinkFields />
      </ActionForm>
    </section>
  );
}
