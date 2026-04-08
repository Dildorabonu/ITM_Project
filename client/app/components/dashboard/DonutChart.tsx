"use client";

import React from "react";

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}

export default function DonutChart({ segments, size = 160, thickness = 28 }: DonutChartProps) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={thickness}
        />
        {/* Segments */}
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLength = pct * circumference;
          const dashOffset = -accumulated * circumference + circumference * 0.25;
          accumulated += pct;
          return (
            <circle
              key={i}
              cx={center} cy={center} r={radius}
              fill="none" stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          );
        })}
      </svg>

      {/* Center label */}
      <div className="dash-donut-center" style={{ marginTop: -size / 2 - 18, marginBottom: size / 2 - 18 }}>
        <div className="dash-donut-total">{total}</div>
        <div className="dash-donut-label">Jami</div>
      </div>

      {/* Legend */}
      <div className="dash-donut-legend" style={{ width: "100%" }}>
        {segments.map((seg, i) => (
          <div key={i} className="dash-donut-legend-item">
            <div className="dash-donut-legend-left">
              <span className="dash-legend-dot" style={{ background: seg.color, width: 10, height: 10, borderRadius: 2, display: "inline-block" }} />
              {seg.label}
            </div>
            <span className="dash-donut-legend-val">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
