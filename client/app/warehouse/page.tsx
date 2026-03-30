"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  costNormService,
  productService,
  type CostNormResponse,

  type ProductResponse,
  PRODUCT_UNIT_LABELS,
} from "@/lib/userService";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}-${m}-${y.slice(-2)}` : "—";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface NormCheckRow {
  id: string;
  title: string;
  contractNo: string;
  createdByFullName: string;
  createdAt: string;
  totalItems: number;
  foundItems: number;
  missingItems: number;
  checked: boolean;
}

interface MaterialCheckItem {
  name: string;
  unit: string;
  totalQty: string;
  found: boolean;
  productQty?: number;
  productUnit?: string;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [costNorms, setCostNorms] = useState<CostNormResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNormId, setSelectedNormId] = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [norms, prods] = await Promise.all([
        costNormService.getAll(),
        productService.getAll(),
      ]);
      setCostNorms(norms);
      setProducts(prods);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Product lookup map ───────────────────────────────────────────────────

  const prodMap = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    for (const p of products) map.set(normalize(p.name), p);
    return map;
  }, [products]);

  // ── Build norm rows ──────────────────────────────────────────────────────

  const normRows = useMemo<NormCheckRow[]>(() => {
    return costNorms.map(norm => {
      const materialItems = (norm.items ?? []).filter(it => !it.isSection && it.name);
      const totalItems = materialItems.length;
      const foundItems = materialItems.filter(it => prodMap.has(normalize(it.name!))).length;
      const missingItems = totalItems - foundItems;
      return {
        id: norm.id,
        title: norm.title,
        contractNo: norm.contractNo ?? "",
        createdByFullName: norm.createdByFullName ?? "",
        createdAt: norm.createdAt ?? "",
        totalItems,
        foundItems,
        missingItems,
        checked: totalItems > 0 && missingItems === 0,
      };
    });
  }, [costNorms, prodMap]);

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return normRows;
    const q = search.toLowerCase();
    return normRows.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.contractNo.toLowerCase().includes(q) ||
      r.createdByFullName.toLowerCase().includes(q)
    );
  }, [normRows, search]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = normRows.length;
    const checked = normRows.filter(r => r.checked).length;
    const unchecked = total - checked;
    return { total, checked, unchecked };
  }, [normRows]);

  // ── Selected norm detail ─────────────────────────────────────────────────

  const selectedNorm = useMemo(() => {
    if (!selectedNormId) return null;
    return costNorms.find(n => n.id === selectedNormId) ?? null;
  }, [costNorms, selectedNormId]);

  const selectedRow = useMemo(() => {
    if (!selectedNormId) return null;
    return normRows.find(r => r.id === selectedNormId) ?? null;
  }, [normRows, selectedNormId]);

  const materialCheckItems = useMemo<MaterialCheckItem[]>(() => {
    if (!selectedNorm) return [];
    return (selectedNorm.items ?? [])
      .filter(it => !it.isSection && it.name)
      .map(it => {
        const match = prodMap.get(normalize(it.name!));
        return {
          name: it.name!,
          unit: it.unit ?? "",
          totalQty: it.totalQty ?? "",
          found: !!match,
          productQty: match?.quantity,
          productUnit: match ? PRODUCT_UNIT_LABELS[match.unit] ?? "" : undefined,
        };
      });
  }, [selectedNorm, prodMap]);

  // ── Browser back ─────────────────────────────────────────────────────────

  useEffect(() => {
    const h = () => { setSelectedNormId(null); };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  // ── Detail: search & filter ──────────────────────────────────────────────

  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilter, setDetailFilter] = useState<"all" | "found" | "missing">("all");

  const filteredMaterials = useMemo(() => {
    let items = materialCheckItems;
    if (detailFilter === "found") items = items.filter(i => i.found);
    if (detailFilter === "missing") items = items.filter(i => !i.found);
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.unit ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [materialCheckItems, detailSearch, detailFilter]);

  // ── Render: Detail view ──────────────────────────────────────────────────

  if (selectedNormId && selectedNorm && selectedRow) {
    const detailStats = {
      total: materialCheckItems.length,
      found: materialCheckItems.filter(i => i.found).length,
      missing: materialCheckItems.filter(i => !i.found).length,
    };
    const pct = detailStats.total > 0 ? Math.round((detailStats.found / detailStats.total) * 100) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Header */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px" }}>
          <button onClick={() => { setSelectedNormId(null); setDetailSearch(""); setDetailFilter("all"); window.history.back(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            ← Orqaga
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedNorm.title}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              {selectedRow.contractNo && <span>Shartnoma: {selectedRow.contractNo}</span>}
              {selectedRow.createdAt && <span style={{ marginLeft: 8 }}>{fmt(selectedRow.createdAt)}</span>}
              {selectedRow.createdByFullName && <span style={{ marginLeft: 8 }}>{selectedRow.createdByFullName}</span>}
            </div>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: selectedRow.checked ? "#e6f4ea" : "#fce8e6",
            color: selectedRow.checked ? "#1e7e34" : "#c62828",
            border: `1px solid ${selectedRow.checked ? "#a8d5b5" : "#f5b7b1"}`,
          }}>
            {selectedRow.checked ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            )}
            {selectedRow.checked ? "To'liq topilgan" : "Kamchilik bor"}
          </span>
        </div>

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Jami materiallar</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>{detailStats.total}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Topilgan</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "#1e7e34" }}>{detailStats.found}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Topilmagan</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: "var(--danger)" }}>{detailStats.missing}</div>
          </div>
          <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Topilganlik darajasi</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 22, color: pct === 100 ? "#1e7e34" : pct >= 50 ? "var(--warn, #d97706)" : "var(--danger)" }}>{pct}%</span>
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--bg3)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: pct === 100 ? "#1e7e34" : pct >= 50 ? "var(--warn, #d97706)" : "var(--danger)", transition: "width 0.3s" }} />
            </div>
          </div>
        </div>

        {/* Search + filter toolbar */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 14px", flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="search-input" placeholder="Material qidirish..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
          </div>
          {(["all", "found", "missing"] as const).map(f => (
            <button key={f} onClick={() => setDetailFilter(f)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", height: 32, borderRadius: "var(--radius)",
                border: `1px solid ${detailFilter === f ? "var(--accent)" : "var(--border)"}`,
                background: detailFilter === f ? "var(--accent-dim, #e8f0fe)" : "var(--bg2)",
                color: detailFilter === f ? "var(--accent)" : "var(--text2)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>
              {f === "all" ? `Barchasi (${detailStats.total})` : f === "found" ? `Topilgan (${detailStats.found})` : `Topilmagan (${detailStats.missing})`}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{filteredMaterials.length} ta natija</span>
        </div>

        {/* Materials table */}
        <div className="itm-card" style={{ flex: 1 }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
            {filteredMaterials.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                {detailSearch || detailFilter !== "all" ? "Natija topilmadi" : "Materiallar yo'q"}
              </div>
            ) : (
              <table className="itm-table">
                <thead>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)" }}>T/r</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Material nomi</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>O&apos;lchov</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Kerakli miqdor</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Mahsulotda miqdori</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Holati</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((item, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "14px 14px" }}>{String(i + 1).padStart(2, "0")}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "14px 14px" }}>{item.name}</td>
                      <td style={{ textAlign: "center", padding: "14px 14px" }}>{item.unit || "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "14px 14px" }}>{item.totalQty || "—"}</td>
                      <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", color: item.found ? "var(--text1)" : "var(--text3)", padding: "14px 14px" }}>
                        {item.found ? `${item.productQty} ${item.productUnit ?? ""}` : "—"}
                      </td>
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                          {item.found ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#e6f4ea", color: "#1e7e34", border: "1px solid #a8d5b5" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                              Topilgan
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#fce8e6", color: "#c62828", border: "1px solid #f5b7b1" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              Topilmagan
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main list ────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Jami norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stats.total}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Tekshirilgan norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e7e34" }}>{stats.checked}</div>
        </div>
        <div className="itm-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Tekshirilmagan norma-rasxodlar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>{stats.unchecked}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: norma-rasxod nomi, shartnoma..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button
          onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Yangilash
        </button>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <div>{search ? "Natija topilmadi" : "Norma-rasxodlar kiritilmagan"}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)" }}>T/r</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Norma-rasxod nomi</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Shartnoma</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Jami materiallar</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Topilgan</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Topilmagan</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Yaratuvchi</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Sana</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Holati</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => { window.history.pushState({ detail: row.id }, ""); setSelectedNormId(row.id); }}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "14px 14px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)", fontWeight: 500, padding: "14px 14px" }}>{row.title}</td>
                    <td style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", padding: "14px 14px" }}>{row.contractNo || "—"}</td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", padding: "14px 14px" }}>{row.totalItems}</td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", color: "#1e7e34", fontWeight: 600, padding: "14px 14px" }}>
                      {row.checked ? row.foundItems : "—"}
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "Inter, sans-serif", color: row.missingItems > 0 ? "var(--danger)" : "var(--text3)", fontWeight: row.checked ? 600 : 400, padding: "14px 14px" }}>
                      {row.checked ? row.missingItems : "—"}
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", padding: "14px 14px" }}>{row.createdByFullName || "—"}</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", padding: "14px 14px" }}>{fmt(row.createdAt)}</td>
                    <td style={{ padding: "14px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        {row.checked ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e7e34" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c62828" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
