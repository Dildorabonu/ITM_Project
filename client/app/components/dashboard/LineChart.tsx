"use client";

import React from "react";

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  fillColor?: string;
}

export default function LineChart({
  data,
  height = 200,
  color = "var(--accent)",
  fillColor = "var(--accent-dim)",
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 16, bottom: 32, left: 40 };
  const width = 500;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value));
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round(minVal + (range / gridLines) * i)
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {/* Grid lines */}
      {gridValues.map((val, i) => {
        const y = padding.top + chartH - ((val - minVal) / range) * chartH;
        return (
          <g key={i}>
            <line
              x1={padding.left} y1={y} x2={width - padding.right} y2={y}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3"
            />
            <text
              x={padding.left - 6} y={y + 4}
              textAnchor="end" fill="var(--text3)" fontSize="10"
              fontFamily="var(--font-inter), Inter, sans-serif"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill={fillColor} opacity="0.5" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--surface)" stroke={color} strokeWidth="2" />
      ))}

      {/* X labels */}
      {points.map((p, i) => (
        <text
          key={i} x={p.x} y={height - 6}
          textAnchor="middle" fill="var(--text3)" fontSize="10"
          fontFamily="var(--font-inter), Inter, sans-serif"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
