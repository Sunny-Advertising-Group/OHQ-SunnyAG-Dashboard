import "server-only";

/**
 * Can this Whatagraph share link be shown in an iframe on the portal?
 * Checks X-Frame-Options and CSP frame-ancestors on the live response.
 * Returns null if the check couldn't run (network error) so the UI can say so.
 * Only https Whatagraph hosts are fetched, so this can't be pointed at arbitrary servers.
 */
export async function checkEmbeddable(url: string, siteUrl: string): Promise<{ allowed: boolean | null; reason: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { allowed: false, reason: "That isn't a valid link." };
  }
  if (u.protocol !== "https:" || !/(^|\.)whatagraph\.com$/i.test(u.hostname))
    return { allowed: false, reason: "Only https Whatagraph share links can be embedded." };

  try {
    const res = await fetch(u, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (OfficeHQ portal embed check)" },
    });
    const xfo = res.headers.get("x-frame-options");
    if (xfo && /deny|sameorigin/i.test(xfo)) return { allowed: false, reason: `Whatagraph sends X-Frame-Options: ${xfo}.` };
    const csp = res.headers.get("content-security-policy") || "";
    const fa = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
    if (fa) {
      const sources = fa.split(/\s+/).slice(1);
      const host = siteUrl ? new URL(siteUrl).host : "";
      const ok = sources.some((s) => s === "*" || (host && (s.includes(host) || (s.startsWith("*.") && host.endsWith(s.slice(1))))));
      if (!ok) return { allowed: false, reason: `Whatagraph only allows embedding on: ${sources.join(" ") || "none"}.` };
    }
    if (!res.ok) return { allowed: null, reason: `Whatagraph returned ${res.status}; couldn't confirm embedding.` };
    return { allowed: true, reason: "Whatagraph allows this link to be embedded." };
  } catch {
    return { allowed: null, reason: "Couldn't reach Whatagraph to check embedding. Try saving again later." };
  }
}
