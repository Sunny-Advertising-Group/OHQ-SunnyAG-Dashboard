import Link from "next/link";
import { Clocks } from "@/components/Clocks";
import { Updated } from "@/components/Updated";
import { getCore, getMe, getSetting, getTeam } from "@/lib/data";
import { initials, latest } from "@/lib/format";

export default async function TeamPage() {
  const [{ isEditor }, { markets }, team, hours] = await Promise.all([getMe(), getCore(), getTeam(), getSetting("team_hours")]);
  const zones = [{ label: "Sunny · Sunshine Coast", tz: "Australia/Brisbane" }, ...markets.map((m) => ({ label: `${m.code} · ${m.tz_label}`, tz: m.tz }))];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Who&apos;s who</h1>
          <p className="sub">Your Sunny account team, what each person looks after, and how to reach them.</p>
        </div>
        <span className="row" style={{ gap: 12 }}>
          <Updated at={latest(hours.updated_at, ...team.map((t) => t.updated_at))} />
          {isEditor && (
            <Link className="btn ghost" href="/admin/team">
              Edit team
            </Link>
          )}
        </span>
      </div>
      <Clocks zones={zones} />
      <p className="meta" style={{ margin: "8px 0 22px" }}>
        {hours.value}
      </p>
      {team.length ? (
        <div className="grid g2">
          {team.map((p) => {
            const ph = !p.name;
            return (
              <div key={p.id} className={`person ${ph ? "placeholder" : ""}`}>
                <div className="avatar" aria-hidden="true">
                  {ph ? "+" : initials(p.name)}
                </div>
                <div>
                  <h3>
                    {ph ? "To be confirmed" : p.name}
                    {p.escalation && (
                      <span className="chip" style={{ marginLeft: 6 }}>
                        Escalation contact
                      </span>
                    )}
                  </h3>
                  <div className="role">
                    {p.role}
                    {p.focus ? ` · ${p.focus}` : ""}
                  </div>
                  <div className="contact">
                    {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                    {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a>}
                    {!p.email && !p.phone && <span className="meta">Contact details to be added</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="emptybox">
          <b>Team details coming</b>Sunny will list who looks after your account and how to reach them.
        </div>
      )}
    </>
  );
}
