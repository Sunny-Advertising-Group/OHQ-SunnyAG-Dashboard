import "server-only";

// Optional email to the account team (Resend). If RESEND_API_KEY isn't set the
// request is still saved on the row and shown in Admin → Creative tracker.
export async function notifyAccountTeam(subject: string, text: string, fallbackTo: string[] = []) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  const to = (process.env.NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const recipients = to.length ? to : fallbackTo.filter(Boolean);
  if (!key || !from || !recipients.length) return { sent: false as const };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false as const };
  }
}
