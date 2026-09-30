import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const notice = sp.expired
    ? "For security, sessions end after 8 hours. Please sign in again."
    : sp.noaccess
      ? "Your account doesn't have access to the portal. Ask your Sunny account team."
      : undefined;
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
            Your media, <span style={{ color: "var(--gold)" }}>in full view.</span>
          </h1>
          <p>Every market, every channel. What&apos;s live, who it&apos;s reaching, how it&apos;s performing and who to call.</p>
        </div>
        <p style={{ fontSize: 12, color: "#6E6E6E", position: "relative", zIndex: 1 }}>Access is invite only.</p>
        <svg className="wave" viewBox="0 0 600 220" aria-hidden="true">
          <path d="M0 150 Q150 60 300 130 T600 90 V220 H0Z" fill="#FDB600" opacity=".08" />
          <path d="M0 180 Q150 100 300 165 T600 130 V220 H0Z" fill="#FDB600" opacity=".16" />
        </svg>
      </div>
      <div className="login-r">
        <LoginForm notice={notice} />
      </div>
    </div>
  );
}
