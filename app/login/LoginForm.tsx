"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form className="login-form" action={action}>
      <h2>Sign in</h2>
      <p className="sub" style={{ marginBottom: 22 }}>
        Use the email your invite was sent to.
      </p>
      <div className="stack" style={{ gap: 14 }}>
        <label className="f">
          Email
          <input className="inp" name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label className="f">
          Password
          <input className="inp" name="password" type="password" autoComplete="current-password" required />
        </label>
        <div className="err" role="alert">
          {state?.error ?? notice ?? ""}
        </div>
        <button className="btn gold" type="submit" style={{ justifyContent: "center" }} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="meta" style={{ marginTop: 22 }}>
        Forgotten your password? Ask your Sunny account team for a fresh link.
      </p>
    </form>
  );
}
