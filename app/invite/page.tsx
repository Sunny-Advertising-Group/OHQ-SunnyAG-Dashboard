"use client";

// Invite and reset links land here (Admin → Users generates them, same as Sunny Sphere).
// Supabase redirects with the session tokens in the URL hash; we set the session,
// then the person chooses a password.
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // @supabase/ssr's browser client doesn't read tokens from the hash itself.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const hashError = params.get("error_description");
    window.history.replaceState(null, "", window.location.pathname);

    const done = (e: string | null, err: string | null = null) => {
      setEmail(e);
      setLinkError(err);
      setReady(true);
    };
    if (hashError) {
      Promise.resolve().then(() => done(null, hashError));
      return;
    }
    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error: e }) => done(data.session?.user.email ?? null, e?.message ?? null));
      return;
    }
    supabase.auth.getSession().then(({ data }) => done(data.session?.user.email ?? null));
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) return setError(err.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="login">
      <div className="login-l">
        <div className="brand" style={{ padding: 0 }}>
          <div className="mark">
            <span />
          </div>
          <div>
            <b style={{ color: "#fff" }}>Sunny Advertising</b>
            <small style={{ color: "#9A9A9A" }}>for OfficeHQ &amp; ReceptionHQ</small>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1>
            Welcome to your <span style={{ color: "var(--gold)" }}>media portal.</span>
          </h1>
          <p>Choose a password to finish setting up your access.</p>
        </div>
        <p style={{ fontSize: 12, color: "#6E6E6E" }}>Access is invite only.</p>
      </div>
      <div className="login-r">
        {!ready ? (
          <p className="meta">Checking your link…</p>
        ) : !email ? (
          <div className="login-form">
            <h2>This link has expired</h2>
            <p className="sub">
              Invite links work once and expire after 24 hours. Ask your Sunny account team to send you a new one.
            </p>
            {linkError && (
              <p className="meta" style={{ marginTop: 12 }}>
                {linkError}
              </p>
            )}
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>Set your password</h2>
            <p className="sub" style={{ marginBottom: 22 }}>
              For {email}
            </p>
            <div className="stack" style={{ gap: 14 }}>
              <label className="f">
                New password
                <input
                  className="inp"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  minLength={10}
                />
              </label>
              <label className="f">
                Confirm password
                <input
                  className="inp"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </label>
              <div className="err" role="alert">
                {error ?? ""}
              </div>
              <button className="btn gold" style={{ justifyContent: "center" }} disabled={submitting}>
                {submitting ? "Saving…" : "Set password & continue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
