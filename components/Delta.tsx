import { delta } from "@/lib/perf";

/** Good/bad deltas are green/red; pass neutral for spend (always grey). */
export function Delta({
  cur,
  prev,
  lowerBetter,
  neutral,
}: {
  cur: number | null | undefined;
  prev: number | null | undefined;
  lowerBetter?: boolean;
  neutral?: boolean;
}) {
  const d = delta(cur, prev, lowerBetter, neutral);
  return <span className={`delta ${d.tone}`}>{d.text}</span>;
}
