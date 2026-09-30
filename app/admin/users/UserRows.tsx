"use client";

import { startTransition as startT, useActionState, useState, useTransition } from "react";
import { inviteUser, newAccessLink, removeUser, saveProfile, setRole, type InviteState } from "../actions";
import { ActionForm, DeleteButton } from "@/components/ActionForm";
import { ROLES } from "@/lib/constants";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  org: string;
  role: string;
  lastSignIn: string | null;
  invited: boolean;
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="linkbox">
      <input className="inp" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Access link" />
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => {
          navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteUser, undefined);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <label className="f">
        Name
        <input className="inp" name="name" required />
      </label>
      <label className="f">
        Email
        <input className="inp" name="email" type="email" required />
      </label>
      <label className="f">
        Organisation
        <input className="inp" name="org" defaultValue="OfficeHQ" />
      </label>
      <label className="f">
        Role
        <select className="inp" name="role" defaultValue="viewer">
          {ROLES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button className="btn gold" type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate invite link"}
      </button>
      {state?.error && <p className="err-msg">{state.error}</p>}
      {state?.ok && (
        <div className="stack" style={{ gap: 6 }}>
          <p className="ok-msg" style={{ margin: 0 }}>
            {state.ok}
          </p>
          {state.link && <CopyLink link={state.link} />}
          <p className="meta" style={{ margin: 0 }}>
            The link isn&apos;t emailed automatically. Copy it and send it to them yourself.
          </p>
        </div>
      )}
    </form>
  );
}

const ROLE_HELP: Record<string, string> = {
  admin: "Edits everything and manages people",
  editor: "Edits portal content",
  viewer: "Client: reads everything, approves creative",
};

/** Access level dropdown: saves the moment it changes, no Save button or refresh needed. */
function RoleSelect({ u, isSelf }: { u: UserRow; isSelf: boolean }) {
  const [state, action, pending] = useActionState(setRole, undefined);
  const [value, setValue] = useState(u.role);
  const sunny = u.email.endsWith("@sunnyadvertising.com.au");
  // A failed save shows the saved level again, with the reason underneath.
  const shown = state?.error && !pending ? u.role : value;
  if (isSelf)
    return (
      <div>
        <b style={{ fontWeight: 600 }}>{ROLES.find(([v]) => v === u.role)?.[1]}</b>
        <div className="meta">That&apos;s you. Another admin can change your access.</div>
      </div>
    );
  return (
    <div>
      <select
        className="inp"
        aria-label={`Access level for ${u.email}`}
        value={shown}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          const fd = new FormData();
          fd.set("id", u.id);
          fd.set("role", e.target.value);
          startT(() => action(fd));
        }}
      >
        {ROLES.map(([v, l]) => (
          <option key={v} value={v} disabled={v !== "viewer" && !sunny}>
            {l}
          </option>
        ))}
      </select>
      <div className="meta" style={{ marginTop: 4 }}>
        {pending ? "Saving…" : state?.ok && !state.error ? `✓ ${state.ok}` : ROLE_HELP[shown]}
      </div>
      {state?.error && !pending && (
        <p className="err-msg" style={{ margin: "4px 0 0" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

export function UserRowView({ u, isSelf }: { u: UserRow; isSelf: boolean }) {
  const [link, setLink] = useState<InviteState>(undefined);
  const [pending, start] = useTransition();
  return (
    <tr>
      <td style={{ minWidth: 200 }}>
        <ActionForm action={saveProfile} className="stack" style={{ gap: 6 }} submit="Save name">
          <input type="hidden" name="id" value={u.id} />
          <input className="inp" name="name" defaultValue={u.name} aria-label="Name" />
          <input className="inp" name="org" defaultValue={u.org} aria-label="Organisation" placeholder="Organisation" />
        </ActionForm>
      </td>
      <td>
        {u.email}
        <div className="meta">
          {u.lastSignIn
            ? `Last sign-in ${new Date(u.lastSignIn).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
            : u.invited
              ? "Invite not accepted yet"
              : "Never signed in"}
        </div>
        {link?.link && (
          <div style={{ marginTop: 6 }}>
            <CopyLink link={link.link} />
          </div>
        )}
        {link?.error && <p className="err-msg">{link.error}</p>}
      </td>
      <td style={{ minWidth: 190 }}>
        <RoleSelect u={u} isSelf={isSelf} />
      </td>
      <td>
        {!isSelf && (
          <div className="stack" style={{ gap: 6 }}>
            <button className="btn ghost sm" type="button" disabled={pending} onClick={() => start(async () => setLink(await newAccessLink(u.id)))}>
              {pending ? "…" : "New link"}
            </button>
            <DeleteButton action={removeUser} id={u.id} confirm={`Remove ${u.email}? They lose access immediately. This can't be undone.`} />
          </div>
        )}
      </td>
    </tr>
  );
}
