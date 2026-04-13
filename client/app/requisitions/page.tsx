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
import { RequisitionDrawer } from "./_components/RequisitionDrawer";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

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
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);
  const canDelete = hasPermission("Requisitions.Delete");

  const [list, setList] = useState<RequisitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerReq, setDrawerReq] = useState<RequisitionResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await requisitionService.getAll();
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await requisitionService.delete(deleteId);
      showToast("Talabnoma o'chirildi", "success");
      setDeleteId(null);
      await load();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally {
      setDeleting(false);
    }
  };

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
              onMouseEnter={e => { if (filterStatus !== opt.value) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; } }}
              onMouseLeave={e => { if (filterStatus !== opt.value) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; } }}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: filterStatus === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                background: filterStatus === opt.value ? "var(--accent-dim)" : "transparent",
                color: filterStatus === opt.value ? "var(--accent)" : "var(--text2)",
                transition: "border-color 0.15s",
              }}
            >{opt.label}</button>
          ))}
        </div>
        <button
          onClick={() => router.push("/requisitions/print")}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
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
        <div className="itm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
          <table className="itm-table" style={{ tableLayout: "auto" }}>
            <thead>
              <tr>
                {["Raqam", "Turi", "Shartnoma / Bo'lim", "Yaratuvchi", "Sana"].map(h => (
                  <th key={h}>{h}</th>
                ))}
                <th style={{ minWidth: 160 }}>Holat</th>
                <th style={{ borderLeft: "2px solid var(--border)", textAlign: "center" }}>Amal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12, textAlign: "left" }}>{r.requisitionNo}</td>
                  <td style={{ textAlign: "left" }}>{r.typeLabel}</td>
                  <td style={{ textAlign: "left" }}>{r.contractNo ?? r.departmentName ?? "—"}</td>
                  <td style={{ textAlign: "left" }}>{r.createdByName}</td>
                  <td style={{ color: "var(--text3)" }}>{fmtDate(r.createdAt)}</td>
                  <td><RequisitionStatusBadge status={r.status} small /></td>
                  <td className="td-actions" style={{ borderLeft: "2px solid var(--border)" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <button
                        className="btn-icon"
                        title="Ko'rish"
                        onClick={() => setDrawerReq(r)}
                        style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {canDelete && r.status !== RequisitionStatus.Approved && r.status !== RequisitionStatus.SentToWarehouse && (
                        <button
                          className="btn-icon btn-icon-danger"
                          title="O'chirish"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                          onClick={() => setDeleteId(r.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Talabnomani o'chirish"
        message="Ushbu talabnoma o'chiriladi. Davom etasizmi?"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {drawerReq && (
        <RequisitionDrawer
          req={drawerReq}
          onClose={() => setDrawerReq(null)}
          onUpdate={updated => {
            setDrawerReq(updated);
            setList(prev => prev.map(r => r.id === updated.id ? updated : r));
          }}
        />
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
