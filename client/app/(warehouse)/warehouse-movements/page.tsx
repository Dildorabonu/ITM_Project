"use client";

import { useEffect, useState } from "react";
import {
  stockMovementService,
  stockMovementSign,
  STOCK_MOVEMENT_COLOR,
  STOCK_MOVEMENT_DIM,
  type StockMovement,
  type StockMovementType,
} from "@/lib/stockMovements";
import { departmentService, type DepartmentOption } from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { STOCK_MOVEMENT_TYPE_OPTIONS, PAGE_SIZE } from "./_types";

// "DD-MM-YY · HH:mm" — drawerdagi format bilan bir xil.
function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 16);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

function directionLabel(m: StockMovement): string {
  if (m.sourceDepartmentName && m.targetDepartmentName)
    return `${m.sourceDepartmentName} → ${m.targetDepartmentName}`;
  if (m.targetDepartmentName) return `→ ${m.targetDepartmentName}`;
  if (m.sourceDepartmentName) return `${m.sourceDepartmentName} →`;
  return "—";
}

export default function WarehouseMovementsPage() {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtrlar — barchasi query param sifatida backendga ketadi (frontendda filter YO'Q).
  const [type, setType] = useState<StockMovementType | "">("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await stockMovementService.get({
        type: type || undefined,
        departmentId: departmentId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(data.items);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount);
    } catch {
      setError("Harakatlar jurnalini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, type, departmentId, from, to]);

  const resetFilters = () => {
    setType("");
    setDepartmentId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const hasFilters = !!(type || departmentId || from || to);

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Filtrlar paneli */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}>
        <CheckSelect
          value={type}
          onChange={v => { setType(v as StockMovementType | ""); setPage(1); }}
          options={STOCK_MOVEMENT_TYPE_OPTIONS}
          placeholder="Harakat turi"
          style={{ width: 190 }}
        />
        <CheckSelect
          value={departmentId}
          onChange={v => { setDepartmentId(v); setPage(1); }}
          options={departments.map(d => ({ id: d.id, name: d.name }))}
          placeholder="Bo'lim"
          style={{ width: 200 }}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          dan
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 13, color: "var(--text)", colorScheme: "dark" }} />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          gacha
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 13, color: "var(--text)", colorScheme: "dark" }} />
        </label>
        {hasFilters && (
          <button onClick={resetFilters}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, borderRadius: "var(--radius)", background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>
            ✕ Tozalash
          </button>
        )}
        <button
          className="btn-icon"
          onClick={load}
          title="Yangilash"
          style={{ marginLeft: "auto", background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Jadval */}
      <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
        {loading ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table className="itm-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 56, minWidth: 56, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", background: "var(--bg2)" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Sana</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Tur</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Mahsulot</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Yo&apos;nalish</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Miqdor</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Qoldiq</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Talabnoma</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Foydalanuvchi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)", background: "var(--bg2)" }}>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : items.map((m, i) => {
                  const color = STOCK_MOVEMENT_COLOR[m.type];
                  const dim = STOCK_MOVEMENT_DIM[m.type];
                  const sign = stockMovementSign(m.type);
                  return (
                    <tr key={m.id}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 56, padding: "0 8px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                        {String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12.5, whiteSpace: "nowrap" }}>{formatDateTime(m.createdAt)}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "2px 9px", borderRadius: 999, background: dim, color,
                          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                          {m.typeLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text1)" }}>{m.productName}</td>
                      <td style={{ textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{directionLabel(m)}</td>
                      <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{sign}{m.quantity}</td>
                      <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text1)", fontWeight: 600 }}>{m.quantityAfter}</td>
                      <td style={{ textAlign: "center", color: m.requisitionNo ? "var(--accent)" : "var(--text3)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{m.requisitionNo || "—"}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", whiteSpace: "nowrap" }}>{m.userFullName || "—"}</td>
                      <td style={{ textAlign: "center", color: "var(--text2)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.notes ?? undefined}>{m.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", marginTop: 8 }}>
        <span style={{ fontSize: 17, color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 450 }}>
          {totalCount} tadan {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&nbsp;–&nbsp;{Math.min(page * PAGE_SIZE, totalCount)}&nbsp;ko&apos;rsatilmoqda
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
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
                <button key={p} className="btn-secondary" onClick={() => setPage(p as number)}
                  style={{
                    minWidth: 30, padding: "5px 8px", fontSize: 12, fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", justifyContent: "center",
                    ...(p === page ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}),
                  }}>
                  {p}
                </button>
              )
            )}
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "5px 12px", fontSize: 12 }}>
            Keyingi →
          </button>
        </div>
      </div>
    </div>
  );
}
