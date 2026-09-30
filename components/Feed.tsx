import type { Change, Channel, Market } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export function Feed({
  items,
  markets,
  channels,
  empty = "Changes to creative, budgets and targeting will show here. Your Sunny team adds them.",
}: {
  items: Change[];
  markets: Market[];
  channels: Channel[];
  empty?: string;
}) {
  if (!items.length)
    return (
      <div className="emptybox">
        <b>No updates yet</b>
        {empty}
      </div>
    );
  return (
    <ul className="feed">
      {items.map((c) => (
        <li key={c.id}>
          <div className="d">{fmtDate(c.date)}</div>
          <div>
            <div className="t">{c.text}</div>
            <div className="tags">
              <span className="chip">{c.type}</span>
              <span className="chip">{c.market_id ? (markets.find((m) => m.id === c.market_id)?.code ?? "") : "All markets"}</span>
              {c.channel_id && <span className="chip">{channels.find((x) => x.id === c.channel_id)?.name ?? ""}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
