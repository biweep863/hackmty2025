"use client";

type Pt = { label: string; value: number };

export default function Sparkline({
  series,
  height = 64,
}: {
  series: Pt[];
  height?: number;
}) {
  if (!series.length) return <div className="h-20" />;

  const values = series.map((s) => s.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const W = Math.max(120, series.length * 20);
  const H = height;
  const pad = 6;

  const points = series.map((s, i) => {
    const x = pad + (i * (W - pad * 2)) / Math.max(1, series.length - 1);
    const y = pad + (H - pad * 2) * (1 - (s.value - min) / range);
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`))
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={H} className="block">
        <path d={path} fill="none" stroke="#22c55e" strokeWidth={2} />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill="#86efac" />
        ))}
      </svg>
    </div>
  );
}
