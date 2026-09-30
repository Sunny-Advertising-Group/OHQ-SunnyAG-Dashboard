// Formatting helpers. Currency always via Intl en-US so it renders A$ / NZ$ / £ / $;
// dates always en-AU. Date strings are 'YYYY-MM-DD' and treated as calendar dates (UTC).

export function money(v: number | null | undefined, cur: string, dp = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  }).format(v);
}

export function num(v: number | null | undefined, dp = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("en-AU", { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

export function pct(v: number | null | undefined, dp = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return (v * 100).toFixed(dp) + "%";
}

export function short(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(v * 10) / 10);
}

export function fmtDate(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  if (!d) return "";
  const [y, m, dd] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-AU", { ...opts, timeZone: "UTC" });
}

/** Format a timestamp (e.g. updated_at) as a date in Brisbane time. */
export function fmtStamp(ts: string | null | undefined, withYear = false): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Australia/Brisbane",
  });
}

export function monthName(k: string, long = false): string {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", {
    month: long ? "long" : "short",
    timeZone: "UTC",
  });
}

export const initials = (n: string | null | undefined) =>
  (n || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export const firstName = (n: string | null | undefined) => (n || "").split(" ")[0] || "there";

/** Today's date in Brisbane, as YYYY-MM-DD. */
export function todayBrisbane(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date());
}

/** Latest of several timestamps, for "Updated" labels. */
export function latest(...ts: (string | null | undefined)[]): string | null {
  const v = ts.filter(Boolean) as string[];
  return v.length ? v.reduce((a, b) => (a > b ? a : b)) : null;
}
