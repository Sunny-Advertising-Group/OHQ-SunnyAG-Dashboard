import { redirect } from "next/navigation";
import { getMe, type Profile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm, UserRowView, type UserRow } from "./UserRows";

export default async function AdminUsers() {
  const { isAdmin, user } = await getMe();
  if (!isAdmin) redirect("/admin");
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("role").order("name");

  let authInfo = new Map<string, { last: string | null; invited: boolean }>();
  let keyMissing = false;
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    authInfo = new Map((data?.users ?? []).map((u) => [u.id, { last: u.last_sign_in_at ?? null, invited: !!u.invited_at && !u.email_confirmed_at }]));
  } catch {
    keyMissing = true;
  }

  const rows: UserRow[] = ((profiles ?? []) as Profile[]).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    org: p.org,
    role: p.role,
    lastSignIn: authInfo.get(p.id)?.last ?? null,
    invited: authInfo.get(p.id)?.invited ?? false,
  }));

  return (
    <div className="split">
      <section className="panel">
        <div className="panel-head">
          <h2>People &amp; access</h2>
          <span className="meta">
            {rows.filter((r) => r.role === "admin").length} admin · {rows.filter((r) => r.role === "editor").length} editor ·{" "}
            {rows.filter((r) => r.role === "viewer").length} viewer
          </span>
        </div>
        <p className="meta" style={{ marginTop: -8 }}>
          Change someone&apos;s access level from the dropdown. It saves straight away.
        </p>
        {keyMissing && (
          <div className="note" style={{ marginBottom: 12 }}>
            <div>
              <b>SUPABASE_SECRET_KEY isn&apos;t set.</b> Add it in Vercel to invite and remove people.
            </div>
          </div>
        )}
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access level</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <UserRowView key={u.id} u={u} isSelf={u.id === user.id} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta" style={{ marginTop: 10 }}>
          <b>Admin</b>: edits everything and manages people. <b>Editor</b>: edits portal content. <b>Viewer</b>: the client; sees every market and
          can approve creative. Admin and editor are for @sunnyadvertising.com.au addresses only, and there must always be at least one admin.
          &ldquo;New link&rdquo; resends an invite or resets a password. Removing someone ends their access immediately.
        </p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Invite someone</h2>
        </div>
        <InviteForm />
      </section>
    </div>
  );
}
