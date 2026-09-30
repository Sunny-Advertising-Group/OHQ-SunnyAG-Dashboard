// Inline SVG charts, ported from the prototype. Gold primary, charcoal secondary,
// then greys. Never tints of gold. Bars stack; the optional line uses the right axis.
import { num, short } from "@/lib/format";

export interface BarSeries {
  name: string;
  hex: string;
  values: number[];
  fmt?: (v: number) => string;
}
export interface LineSeries {
  name: string;
  values: (number | null)[];
  fmt?: (v: number) => string;
}

function niceMax(v: number) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function Chart({
  labels,
  bars = [],
  line = null,
  h = 230,
  w = 720,
  fmtL = short,
  fmtR = short,
  title,
}: {
  labels: string[];
  bars?: BarSeries[];
  line?: LineSeries | null;
  h?: number;
  w?: number;
  fmtL?: (v: number) => string;
  fmtR?: (v: number) => string;
  title: string;
}) {
  const W = w,
    H = h,
    pl = 44,
    pr = line ? 46 : 12,
    pt = 14,
    pb = 30;
  const pw = W - pl - pr,
    ph = H - pt - pb,
    n = Math.max(labels.length, 1),
    step = pw / n,
    bw = Math.min(46, step * 0.58);
  const sums = labels.map((_, i) => bars.reduce((a, b) => a + (b.values[i] || 0), 0));
  const maxY = niceMax(Math.max(...sums, 0));
  const maxL = line ? niceMax(Math.max(...(line.values.filter((v) => v != null) as number[]), 0)) : 1;

  const grid = [0, 1, 2, 3, 4].map((k) => {
    const y = pt + ph - (ph * k) / 4;
    return (
      <g key={k}>
        <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
        <text x={pl - 8} y={y + 4} textAnchor="end">
          {fmtL((maxY * k) / 4)}
        </text>
        {line && (
          <text x={W - pr + 8} y={y + 4}>
            {fmtR((maxL * k) / 4)}
          </text>
        )}
      </g>
    );
  });

  const cols = labels.map((lab, i) => {
    const x = pl + step * i + (step - bw) / 2;
    let yAcc = pt + ph;
    return (
      <g key={i}>
        {bars.map((b) => {
          const v = b.values[i] || 0;
          if (!v) return null;
          const bh = (ph * v) / maxY;
          yAcc -= bh;
          return (
            <rect key={b.name} x={x} y={yAcc} width={bw} height={Math.max(bh, 0.5)} fill={b.hex} rx={2}>
              <title>{`${lab} · ${b.name}: ${b.fmt ? b.fmt(v) : num(v, 1)}`}</title>
            </rect>
          );
        })}
        <text x={pl + step * i + step / 2} y={H - 10} textAnchor="middle">
          {lab}
        </text>
      </g>
    );
  });

  let path = "";
  const pts = line
    ? line.values.map((v, i) => (v == null ? null : [pl + step * i + step / 2, pt + ph - (ph * v) / maxL]))
    : [];
  if (line) {
    let started = false;
    for (const p of pts) {
      if (!p) {
        started = false;
        continue;
      }
      path += (started ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      started = true;
    }
  }

  return (
    <>
      <div className="chart" role="img" aria-label={title}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {grid}
          {cols}
          {line && <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />}
          {line &&
            pts.map((p, i) =>
              p ? (
                <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2}>
                  <title>{`${labels[i]} · ${line.name}: ${line.fmt ? line.fmt(line.values[i]!) : num(line.values[i], 1)}`}</title>
                </circle>
              ) : null,
            )}
        </svg>
      </div>
      <div className="legend">
        {bars.map((b) => (
          <span key={b.name}>
            <i style={{ background: b.hex }} />
            {b.name}
          </span>
        ))}
        {line && (
          <span>
            <i className="ln" style={{ background: "var(--ink)" }} />
            {line.name} (right axis)
          </span>
        )}
      </div>
    </>
  );
}

export function Spark({ values, w = 120, h = 34 }: { values: (number | null)[]; w?: number; h?: number }) {
  const v = values.map((x) => x ?? 0);
  if (v.length < 2) return null;
  const max = Math.max(...v, 1),
    n = v.length;
  const pts = v.map((y, i) => [(i * (w - 4)) / (n - 1) + 2, h - 3 - ((h - 6) * y) / max]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline
        points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--gold)" />
    </svg>
  );
}
