"use client";

// Ro'yxat ko'rinishlari uchun umumiy sahifalash futeri.
export function ReadinessPagination({
  page, totalPages, totalCount, pageSize, onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  return (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", marginTop: 8 }}>
      <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
        {totalCount} tadan {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}&nbsp;–&nbsp;{Math.min(page * pageSize, totalCount)}&nbsp;ko&apos;rsatilmoqda
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
          ← Oldingi
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "var(--text3)", padding: "0 2px" }}>…</span>
            ) : (
              <button
                key={p}
                className="btn-secondary"
                onClick={() => onPage(p as number)}
                style={{
                  minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                  fontVariantNumeric: "tabular-nums", justifyContent: "center",
                  ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                }}
              >
                {p}
              </button>
            )
          )}
        <button className="btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
          Keyingi →
        </button>
      </div>
    </div>
  );
}
