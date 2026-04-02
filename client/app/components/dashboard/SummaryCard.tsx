"use client";

import React from "react";

interface SummaryCardProps {
  label: string;
  value: number | string;
  meta?: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  icon: React.ReactNode;
  iconBg: string;
}

export default function SummaryCard({ label, value, meta, trend, icon, iconBg }: SummaryCardProps) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-value">{value}</div>
      <div className="dash-kpi-footer">
        {meta && <span className="dash-kpi-meta">{meta}</span>}
        {trend && (
          <span className={`dash-kpi-trend ${trend.direction}`}>
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "—"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
