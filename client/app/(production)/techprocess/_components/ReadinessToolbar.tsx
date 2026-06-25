"use client";

// Faol/Arxiv toggle + qidiruv + yangilash — `/techprocess` va `/costnorm`
// ro'yxat ko'rinishlari uchun umumiy toolbar.
export function ReadinessToolbar({
  viewMode, onViewMode, search, onSearch, onRefresh, searchPlaceholder = "Shartnoma raqami bo'yicha qidirish...",
}: {
  viewMode: "active" | "archive";
  onViewMode: (m: "active" | "archive") => void;
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => onViewMode("active")}
          style={{
            padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
            background: viewMode === "active" ? "var(--accent)" : "transparent",
            color: viewMode === "active" ? "#fff" : "var(--text2)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          Faol
        </button>
        <button
          onClick={() => onViewMode("archive")}
          style={{
            padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
            background: viewMode === "archive" ? "var(--text3)" : "transparent",
            color: viewMode === "archive" ? "#fff" : "var(--text2)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
          Arxiv
        </button>
      </div>

      <div className="search-wrap" style={{ flex: 1, minWidth: 180, maxWidth: "none" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input className="search-input" placeholder={searchPlaceholder} value={search} onChange={e => onSearch(e.target.value)} />
      </div>
      <button className="btn-icon" onClick={onRefresh} title="Yangilash" style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
      </button>
    </div>
  );
}
