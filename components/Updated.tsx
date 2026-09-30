import { fmtStamp } from "@/lib/format";

/** Every section shows when it was last updated. Stale content is a trust risk, so it's never hidden. */
export function Updated({ at, label = "Updated" }: { at: string | null | undefined; label?: string }) {
  return <span className="updated">{at ? `${label} ${fmtStamp(at, true)}` : "Not updated yet"}</span>;
}
