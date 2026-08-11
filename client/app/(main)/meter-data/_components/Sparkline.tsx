"use client";

/**
 * Karta ichidagi mini-grafik. O'q, yorliq, tooltip yo'q — u faqat shakl
 * ko'rsatadi, aniq qiymat kartadagi raqamda turadi.
 */
export function Sparkline({
  values,
  color,
  height = 28,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const W = 100;

  if (values.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center" }}>
        <div style={{ height: 1, width: "100%", background: "var(--border)" }} />
      </div>
    );
  }

  const max = Math.max(...values, 0);
  const scale = max > 0 ? max : 1;

  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => height - (v / scale) * (height - 2) - 1;

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${height} L0,${height} Z`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
