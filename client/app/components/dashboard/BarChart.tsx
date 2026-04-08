"use client";

import React from "react";

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  barColor?: string;
}

export default function BarChart({
  data,
  height = 200,
  barColor = "var(--accent)",
}: BarChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 16, right: 16, bottom: 40, left: 40 };
  const width = 500;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value));
  const barWidth = Math.min(chartW / data.length * 0.6, 40);
  const gap = chartW / data.length;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round((maxVal / gridLines) * i)
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {/* Grid lines */}
      {gridValues.map((val, i) => {
        const y = padding.top + chartH - (val / (maxVal || 1)) * chartH;
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

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.value / (maxVal || 1)) * chartH;
        const x = padding.left + gap * i + (gap - barWidth) / 2;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barWidth} height={barH}
              rx="3" fill={d.color || barColor} opacity="0.85"
            />
            <text
              x={x + barWidth / 2} y={y - 5}
              textAnchor="middle" fill="var(--text2)" fontSize="10" fontWeight="600"
              fontFamily="var(--font-inter), Inter, sans-serif"
            >
              {d.value}
            </text>
            <text
              x={padding.left + gap * i + gap / 2}
              y={height - 8}
              textAnchor="middle" fill="var(--text3)" fontSize="9"
              fontFamily="var(--font-inter), Inter, sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
