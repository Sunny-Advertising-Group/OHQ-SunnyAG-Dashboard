// Turns a Google Sheets API (includeGridData) response for one tab into a compact,
// render-ready snapshot that reproduces the sheet's look: values as displayed,
// fills, fonts, alignment, borders, merges, column widths, row heights and
// frozen rows/columns. Pure, so it's unit-tested without Google.

export interface CellStyle {
  bg?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  size?: number; // pt
  font?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  wrap?: "wrap" | "clip" | "overflow";
  bt?: string; // CSS border shorthand per side
  bb?: string;
  bl?: string;
  br?: string;
}

export interface SnapCell {
  t?: string; // formatted value, exactly as the sheet shows it
  s?: number; // index into styles
  n?: boolean; // numeric (right-aligned by default, like Sheets)
  flag?: string; // note shown on hover, e.g. a Monthly Total that adds up weekly ratios
}

export interface SheetSnapshot {
  title: string;
  gid: number;
  frozenRows: number;
  frozenCols: number;
  gridlines: boolean;
  colWidths: number[];
  rowHeights: number[];
  rows: SnapCell[][];
  styles: CellStyle[];
  merges: { r: number; c: number; rs: number; cs: number }[];
}

type RGB = { red?: number; green?: number; blue?: number; alpha?: number };
type ColorStyle = { rgbColor?: RGB; themeColor?: string };
interface ApiBorder {
  style?: string;
  width?: number;
  color?: RGB;
  colorStyle?: ColorStyle;
}
interface ApiCell {
  formattedValue?: string;
  effectiveValue?: { numberValue?: number; stringValue?: string; boolValue?: boolean; formulaValue?: string };
  effectiveFormat?: {
    backgroundColor?: RGB;
    backgroundColorStyle?: ColorStyle;
    horizontalAlignment?: string;
    verticalAlignment?: string;
    wrapStrategy?: string;
    textFormat?: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      fontSize?: number;
      fontFamily?: string;
      foregroundColor?: RGB;
      foregroundColorStyle?: ColorStyle;
    };
    borders?: { top?: ApiBorder; bottom?: ApiBorder; left?: ApiBorder; right?: ApiBorder };
  };
}
export interface ApiSheet {
  properties: {
    sheetId: number;
    title: string;
    gridProperties?: { frozenRowCount?: number; frozenColumnCount?: number; hideGridlines?: boolean };
  };
  merges?: { startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }[];
  data?: {
    startRow?: number;
    startColumn?: number;
    rowData?: { values?: ApiCell[] }[];
    rowMetadata?: { pixelSize?: number; hiddenByUser?: boolean }[];
    columnMetadata?: { pixelSize?: number; hiddenByUser?: boolean }[];
  }[];
}
export interface ApiTheme {
  themeColors?: { colorType: string; color: ColorStyle }[];
}

const hex = (c?: RGB): string | undefined => {
  if (!c) return undefined;
  const to = (v?: number) =>
    Math.round((v ?? 0) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(c.red)}${to(c.green)}${to(c.blue)}`;
};

function resolve(cs: ColorStyle | undefined, plain: RGB | undefined, theme: ApiTheme | undefined): string | undefined {
  if (cs?.rgbColor) return hex(cs.rgbColor);
  if (cs?.themeColor) {
    const t = theme?.themeColors?.find((x) => x.colorType === cs.themeColor);
    if (t?.color?.rgbColor) return hex(t.color.rgbColor);
  }
  return hex(plain);
}

function border(b: ApiBorder | undefined, theme: ApiTheme | undefined): string | undefined {
  if (!b?.style || b.style === "NONE") return undefined;
  const color = resolve(b.colorStyle, b.color, theme) ?? "#000000";
  const w = b.style === "SOLID_THICK" ? 3 : b.style === "SOLID_MEDIUM" ? 2 : 1;
  const kind = b.style === "DASHED" ? "dashed" : b.style === "DOTTED" ? "dotted" : b.style === "DOUBLE" ? "double" : "solid";
  return `${b.style === "DOUBLE" ? 3 : w}px ${kind} ${color}`;
}

const WHITE = "#ffffff";
const BLACK = "#000000";

function styleOf(cell: ApiCell | undefined, theme: ApiTheme | undefined): CellStyle {
  const f = cell?.effectiveFormat;
  if (!f) return {};
  const tf = f.textFormat ?? {};
  const s: CellStyle = {};
  const bg = resolve(f.backgroundColorStyle, f.backgroundColor, theme);
  if (bg && bg !== WHITE) s.bg = bg;
  const color = resolve(tf.foregroundColorStyle, tf.foregroundColor, theme);
  if (color && color !== BLACK) s.color = color;
  if (tf.bold) s.bold = true;
  if (tf.italic) s.italic = true;
  if (tf.strikethrough) s.strike = true;
  if (tf.underline) s.underline = true;
  if (tf.fontSize && tf.fontSize !== 10) s.size = tf.fontSize;
  if (tf.fontFamily && tf.fontFamily !== "Arial") s.font = tf.fontFamily;
  const ha = f.horizontalAlignment;
  if (ha === "LEFT" || ha === "CENTER" || ha === "RIGHT") s.align = ha.toLowerCase() as CellStyle["align"];
  const va = f.verticalAlignment;
  if (va === "TOP" || va === "MIDDLE") s.valign = va.toLowerCase() as CellStyle["valign"];
  if (f.wrapStrategy === "WRAP") s.wrap = "wrap";
  else if (f.wrapStrategy === "CLIP") s.wrap = "clip";
  const b = f.borders;
  if (b) {
    const bt = border(b.top, theme),
      bb = border(b.bottom, theme),
      bl = border(b.left, theme),
      br = border(b.right, theme);
    if (bt) s.bt = bt;
    if (bb) s.bb = bb;
    if (bl) s.bl = bl;
    if (br) s.br = br;
  }
  return s;
}

const isEmptyStyle = (s: CellStyle) => Object.keys(s).length === 0;

export function buildSnapshot(sheet: ApiSheet, theme?: ApiTheme): SheetSnapshot {
  const grid = sheet.data?.[0] ?? {};
  const rowData = grid.rowData ?? [];
  const rowMeta = grid.rowMetadata ?? [];
  const colMeta = grid.columnMetadata ?? [];

  // Build raw cells and dedupe styles.
  const styles: CellStyle[] = [];
  const styleKey = new Map<string, number>();
  const intern = (s: CellStyle) => {
    if (isEmptyStyle(s)) return undefined;
    const k = JSON.stringify(s);
    let i = styleKey.get(k);
    if (i == null) {
      i = styles.length;
      styles.push(s);
      styleKey.set(k, i);
    }
    return i;
  };

  const raw: SnapCell[][] = rowData.map((r) =>
    (r.values ?? []).map((c) => {
      const out: SnapCell = {};
      if (c.formattedValue != null && c.formattedValue !== "") out.t = c.formattedValue;
      if (c.effectiveValue?.numberValue != null) out.n = true;
      const si = intern(styleOf(c, theme));
      if (si != null) out.s = si;
      return out;
    }),
  );

  // Trim to the used area: last row/col with a value or a visible format.
  let lastRow = -1,
    lastCol = -1;
  raw.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c.t != null || c.s != null) {
        if (ri > lastRow) lastRow = ri;
        if (ci > lastCol) lastCol = ci;
      }
    }),
  );
  // Only formatting (no values) past the last value doesn't count as content.
  let lastValueRow = -1,
    lastValueCol = -1;
  raw.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c.t != null) {
        if (ri > lastValueRow) lastValueRow = ri;
        if (ci > lastValueCol) lastValueCol = ci;
      }
    }),
  );
  lastRow = Math.min(lastRow, lastValueRow + 1);
  lastCol = Math.min(lastCol, lastValueCol + 1);
  const nRows = lastRow + 1,
    nCols = lastCol + 1;

  const rows: SnapCell[][] = [];
  for (let r = 0; r < nRows; r++) {
    const src = raw[r] ?? [];
    const row: SnapCell[] = [];
    for (let c = 0; c < nCols; c++) row.push(src[c] ?? {});
    rows.push(row);
  }

  const merges = (sheet.merges ?? [])
    .map((m) => ({
      r: m.startRowIndex ?? 0,
      c: m.startColumnIndex ?? 0,
      rs: (m.endRowIndex ?? 0) - (m.startRowIndex ?? 0),
      cs: (m.endColumnIndex ?? 0) - (m.startColumnIndex ?? 0),
    }))
    .filter((m) => m.r < nRows && m.c < nCols && m.rs > 0 && m.cs > 0)
    .map((m) => ({ ...m, rs: Math.min(m.rs, nRows - m.r), cs: Math.min(m.cs, nCols - m.c) }));

  const colWidths = Array.from({ length: nCols }, (_, c) => (colMeta[c]?.hiddenByUser ? 0 : (colMeta[c]?.pixelSize ?? 100)));
  const rowHeights = Array.from({ length: nRows }, (_, r) => (rowMeta[r]?.hiddenByUser ? 0 : (rowMeta[r]?.pixelSize ?? 21)));

  const snap: SheetSnapshot = {
    title: sheet.properties.title,
    gid: sheet.properties.sheetId,
    frozenRows: Math.min(sheet.properties.gridProperties?.frozenRowCount ?? 0, nRows),
    frozenCols: Math.min(sheet.properties.gridProperties?.frozenColumnCount ?? 0, nCols),
    gridlines: !sheet.properties.gridProperties?.hideGridlines,
    colWidths,
    rowHeights,
    rows,
    styles,
    merges,
  };
  flagSummedRatios(snap);
  return snap;
}

/**
 * The media report's "Monthly Total" (and "Total") columns SUM weekly ratios, e.g.
 * AU Google Ads August CTR reads 66.1%. Those cells are kept exactly as the sheet
 * shows them, but flagged so the viewer isn't misled.
 */
export function flagSummedRatios(snap: SheetSnapshot) {
  const header = snap.rows.slice(0, 3);
  const totalCols = new Set<number>();
  header.forEach((r) =>
    r.forEach((c, ci) => {
      if (c.t && /^(monthly\s+)?total$/i.test(c.t.trim())) totalCols.add(ci);
    }),
  );
  if (!totalCols.size) return;
  for (const row of snap.rows) {
    const label = (row[1]?.t ?? "").trim().toLowerCase();
    if (!/^(ctr|cpc|cpl|conversion rate)/.test(label)) continue;
    for (const ci of totalCols) {
      const cell = row[ci];
      if (cell?.t)
        cell.flag =
          "This total adds up the weekly figures, so it overstates the real rate. The market pages show it recalculated from totals.";
    }
  }
}
