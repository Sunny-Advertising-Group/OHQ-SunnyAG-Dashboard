import { Icon } from "@/components/Icon";
import type { LinkRow } from "@/lib/data";

export function LinkTile({ l }: { l: LinkRow }) {
  const inner = (
    <>
      <div className="ic">
        <Icon name={l.icon} />
      </div>
      <div>
        <b>{l.label}</b>
        <small>{l.url ? l.description : "Link not added yet"}</small>
      </div>
    </>
  );
  return l.url ? (
    <a className="qlink" href={l.url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <div className="qlink unset">{inner}</div>
  );
}
