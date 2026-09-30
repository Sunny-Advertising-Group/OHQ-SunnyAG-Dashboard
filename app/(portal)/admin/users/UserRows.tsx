"use client";

import { useActionState, useState, useTransition } from "react";
import { changeRole, inviteUser, newAccessLink, removeUser, type InviteState } from "../actions";
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

export function UserRowView({ u, isSelf }: { u: UserRow; isSelf: boolean }) {
  const [link, setLink] = useState<InviteState>(undefined);
  const [pending, start] = useTransition();
  return (
    <tr>
      <td>
        {isSelf ? (
          <>
            {u.name}
            <div className="meta">
              {u.org} · {u.email}
            </div>
          </>
        ) : (
          <ActionForm action={changeRole} className="stack" style={{ gap: 6, minWidth: 220 }} submit="Save">
            <input type="hidden" name="id" value={u.id} />
            <input className="inp" name="name" defaultValue={u.name} aria-label="Name" />
            <input className="inp" name="org" defaultValue={u.org} aria-label="Organisation" />
            <select className="inp" name="role" defaultValue={u.role} aria-label="Role">
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </ActionForm>
        )}
      </td>
      <td>
        {u.email}
        <div className="meta">
          {u.lastSignIn ? `Last sign-in ${new Date(u.lastSignIn).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : u.invited ? "Invite not accepted yet" : "Never signed in"}
        </div>
        {link?.link && (
          <div style={{ marginTop: 6 }}>
            <CopyLink link={link.link} />
          </div>
        )}
        {link?.error && <p className="err-msg">{link.error}</p>}
      </td>
      <td>{ROLES.find(([v]) => v === u.role)?.[1]}</td>
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
