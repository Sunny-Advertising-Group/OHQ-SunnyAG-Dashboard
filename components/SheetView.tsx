import type { CSSProperties } from "react";
import type { SheetSnapshot } from "@/lib/sheet-grid";

// Renders a SheetSnapshot as an HTML table that looks like the Google Sheet:
// same displayed values, fills, fonts, alignment, borders, merges, sizes and frozen panes.
const GRIDLINE = "1px solid #e2e3e3";

export function SheetView({ snap }: { snap: SheetSnapshot }) {
  const anchors = new Map<string, { rs: number; cs: number }>();
  const covered = new Set<string>();
  for (const m of snap.merges) {
    anchors.set(`${m.r}:${m.c}`, { rs: m.rs, cs: m.cs });
    for (let r = m.r; r < m.r + m.rs; r++) for (let c = m.c; c < m.c + m.cs; c++) if (r !== m.r || c !== m.c) covered.add(`${r}:${c}`);
  }
  const visibleCols = snap.colWidths.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0);
  const left: number[] = [];
  let acc = 0;
  for (let c = 0; c < snap.colWidths.length; c++) {
    left[c] = acc;
    acc += snap.colWidths[c];
  }
  const top: number[] = [];
  acc = 0;
  for (let r = 0; r < snap.rowHeights.length; r++) {
    top[r] = acc;
    acc += snap.rowHeights[r];
  }
  const width = visibleCols.reduce((a, c) => a + snap.colWidths[c], 0);

  return (
    <table className="sheet" style={{ width }}>
      <colgroup>
        {visibleCols.map((c) => (
          <col key={c} style={{ width: snap.colWidths[c] }} />
        ))}
      </colgroup>
      <tbody>
        {snap.rows.map((row, r) => {
          if (snap.rowHeights[r] === 0) return null;
          const marketId = /^(OFFICEHQ|RECEPTIONHQ)\s*-\s*([A-Z]{2})/i.exec(row[0]?.t ?? "")?.[2]?.toLowerCase();
          return (
            <tr key={r} style={{ height: snap.rowHeights[r] }} id={marketId ? `sheet-${marketId}` : undefined}>
              {visibleCols.map((c) => {
                const key = `${r}:${c}`;
                if (covered.has(key)) return null;
                const cell = row[c] ?? {};
                const st = cell.s != null ? snap.styles[cell.s] : {};
                const span = anchors.get(key);
                const frozenRow = r < snap.frozenRows;
                const frozenCol = c < snap.frozenCols;
                const css: CSSProperties = {
                  background: st.bg ?? (frozenRow || frozenCol ? "#ffffff" : undefined),
                  color: st.color,
                  fontWeight: st.bold ? 700 : undefined,
                  fontStyle: st.italic ? "italic" : undefined,
                  textDecoration: [st.underline && "underline", st.strike && "line-through"].filter(Boolean).join(" ") || undefined,
                  fontSize: st.size ? `${st.size}pt` : undefined,
                  fontFamily: st.font ? `"${st.font}", Arial, sans-serif` : undefined,
                  textAlign: st.align ?? (cell.n ? "right" : "left"),
                  verticalAlign: st.valign ?? "bottom",
                  whiteSpace: st.wrap === "wrap" ? "normal" : "nowrap",
                  overflow: st.wrap === "clip" ? "hidden" : "visible",
                  borderTop: st.bt ?? (snap.gridlines ? GRIDLINE : undefined),
                  borderBottom: st.bb ?? (snap.gridlines ? GRIDLINE : undefined),
                  borderLeft: st.bl ?? (snap.gridlines ? GRIDLINE : undefined),
                  borderRight: st.br ?? (snap.gridlines ? GRIDLINE : undefined),
                  position: frozenRow || frozenCol ? "sticky" : undefined,
                  top: frozenRow ? top[r] : undefined,
                  left: frozenCol ? left[c] : undefined,
                  zIndex: frozenRow && frozenCol ? 3 : frozenRow || frozenCol ? 2 : undefined,
                };
                return (
                  <td
                    key={c}
                    style={css}
                    rowSpan={span?.rs}
                    colSpan={span?.cs}
                    className={cell.flag ? "sheet-flag" : undefined}
                    title={cell.flag}
                  >
                    {cell.t ?? ""}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
