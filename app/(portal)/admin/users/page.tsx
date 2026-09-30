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
          <h2>People with access</h2>
        </div>
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
                <th>Name &amp; access</th>
                <th>Email</th>
                <th>Role</th>
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
          Viewers see every market and can approve creative. Editors change content; admins can also manage people. Editor and admin access is
          limited to @sunnyadvertising.com.au addresses. &ldquo;New link&rdquo; resends an invite or resets a password. Removing someone ends their
          access immediately. Sessions end 8 hours after sign-in.
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
