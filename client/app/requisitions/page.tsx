"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  requisitionService,
  RequisitionStatus,
  type RequisitionResponse,
} from "@/lib/userService";
import {
  fmtDate,
  REQUISITION_STATUS_LABELS,
} from "./_types";
import { RequisitionStatusBadge } from "./_components/StatusBadge";

// ─── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTER = [
  { value: "", label: "Barchasi" },
  { value: String(RequisitionStatus.Draft),           label: REQUISITION_STATUS_LABELS[RequisitionStatus.Draft] },
  { value: String(RequisitionStatus.Pending),         label: REQUISITION_STATUS_LABELS[RequisitionStatus.Pending] },
  { value: String(RequisitionStatus.Approved),        label: REQUISITION_STATUS_LABELS[RequisitionStatus.Approved] },
  { value: String(RequisitionStatus.Rejected),        label: REQUISITION_STATUS_LABELS[RequisitionStatus.Rejected] },
  { value: String(RequisitionStatus.SentToWarehouse), label: REQUISITION_STATUS_LABELS[RequisitionStatus.SentToWarehouse] },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

function RequisitionsContent() {
  const router = useRouter();
  const [list, setList] = useState<RequisitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await requisitionService.getAll();
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = list;
    if (filterStatus !== "") res = res.filter(r => r.status === Number(filterStatus));
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        r.requisitionNo.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        (r.contractNo ?? "").toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.createdByName.toLowerCase().includes(q)
      );
    }
    return res;
  }, [list, search, filterStatus]);

  return (
    <div>
      {/* Toolbar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Qidirish"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_FILTER.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: filterStatus === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                background: filterStatus === opt.value ? "var(--accent-dim)" : "transparent",
                color: filterStatus === opt.value ? "var(--accent)" : "var(--text2)",
              }}
            >{opt.label}</button>
          ))}
        </div>
        <button
          onClick={() => router.push("/requisitions/print")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6,9 6,2 18,2 18,9" />
            <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Blank
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>Yuklanmoqda…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>Talabnomalar topilmadi</div>
      ) : (
        <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius2)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg3)" }}>
                {["Raqam", "Turi", "Maqsad", "Shartnoma / Bo'lim", "Materiallar", "Yaratuvchi", "Sana", "Holat"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text2)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/requisitions/${r.id}`)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.requisitionNo}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text2)" }}>{r.typeLabel}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text1)", maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.purpose}</div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text2)" }}>{r.contractNo ?? r.departmentName ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text2)", textAlign: "center" }}>{r.items.length}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text2)" }}>{r.createdByName}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text3)", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ padding: "10px 14px" }}><RequisitionStatusBadge status={r.status} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RequisitionsPage() {
  return (
    <Suspense>
      <RequisitionsContent />
    </Suspense>
  );
}
