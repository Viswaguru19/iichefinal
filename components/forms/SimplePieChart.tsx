/** Lightweight SVG pie chart for form response summaries. */
export type PieSlice = { label: string; value: number; color: string };

const DEFAULT_COLORS = [
  '#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6', '#f97316',
];

export function pieColors(n: number): string[] {
  return Array.from({ length: n }, (_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y} Z`;
}

export default function SimplePieChart({
  slices,
  size = 168,
}: {
  slices: PieSlice[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return (
      <div
        className="rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  // Single full slice — SVG arc of 360 can collapse; use a circle.
  if (slices.filter((s) => s.value > 0).length === 1) {
    const only = slices.find((s) => s.value > 0)!;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill={only.color} />
      </svg>
    );
  }

  let angle = 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...s, d: arcPath(cx, cy, r, start, end) };
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {paths.map((p) => (
        <path key={p.label} d={p.d} fill={p.color} stroke="#fff" strokeWidth={1.5} />
      ))}
    </svg>
  );
}
