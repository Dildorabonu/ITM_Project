"use client";

// Ishlab chiqarilgan / umumiy miqdor nisbatini progress bar ko'rinishida ko'rsatadi.
export function ProgressBar({ produced, total }: { produced: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((produced / total) * 100)) : 0;
  const isDone = pct >= 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
        <span>{produced} / {total}</span>
        <span style={{ color: isDone ? "var(--success)" : "var(--accent)", fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--bg3)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: isDone ? "var(--success)" : "var(--accent)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}
