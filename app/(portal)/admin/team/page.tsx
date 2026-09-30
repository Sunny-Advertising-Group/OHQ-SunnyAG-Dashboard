import { ActionForm, DeleteButton } from "@/components/ActionForm";
import { Updated } from "@/components/Updated";
import { getSetting, getTeam, type TeamMember } from "@/lib/data";
import { latest } from "@/lib/format";
import { deleteTeamMember, saveHours, saveTeamMember } from "../actions";

function PersonFields({ p }: { p?: TeamMember }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="f">
        Name
        <input className="inp" name="name" defaultValue={p?.name} placeholder="Leave blank to show “To be confirmed”" />
      </label>
      <label className="f">
        Role
        <input className="inp" name="role" defaultValue={p?.role} />
      </label>
      <label className="f">
        Email
        <input className="inp" name="email" type="email" defaultValue={p?.email} />
      </label>
      <label className="f">
        Phone
        <input className="inp" name="phone" type="tel" defaultValue={p?.phone} />
      </label>
      <label className="f half">
        Looks after
        <input className="inp" name="focus" defaultValue={p?.focus} />
      </label>
      <label className="f">
        Order
        <input className="inp" name="sort" type="number" defaultValue={p?.sort ?? 99} />
      </label>
      <label className="f">
        <span className="row" style={{ gap: 8, marginTop: 22 }}>
          <input type="checkbox" name="escalation" defaultChecked={p?.escalation} /> Escalation contact
        </span>
      </label>
    </>
  );
}

export default async function AdminTeam() {
  const [team, hours] = await Promise.all([getTeam(), getSetting("team_hours")]);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Who&apos;s who</h2>
        <Updated at={latest(hours.updated_at, ...team.map((t) => t.updated_at))} />
      </div>
      <ActionForm action={saveHours} className="stack" style={{ gap: 8, marginBottom: 18 }} submit="Save hours">
        <label className="f">
          Working hours line (shown under the clocks)
          <input className="inp" name="value" defaultValue={hours.value} />
        </label>
      </ActionForm>
      <div className="stack" style={{ gap: 12 }}>
        {team.map((p) => (
          <div key={p.id} className="stack" style={{ gap: 6 }}>
            <ActionForm action={saveTeamMember} className="crow" submit="Save">
              <PersonFields p={p} />
            </ActionForm>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <DeleteButton action={deleteTeamMember} id={p.id} confirm={`Remove ${p.name || "this slot"} from Who's who?`} />
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt2" style={{ marginBottom: 10 }}>
        Add a person
      </h3>
      <ActionForm action={saveTeamMember} className="crow" submit="Add person" submitClass="btn gold sm" resetOnSuccess>
        <PersonFields />
      </ActionForm>
    </section>
  );
}
