"use client";

import { useEffect, useMemo, useState } from "react";
import {
  technicalDrawingService,
  contractService,
  DrawingStatus,
  DRAWING_STATUS_LABELS,
  type TechnicalDrawingResponse,
  type ContractResponse,
  type AttachmentResponse,
} from "@/lib/userService";

import { ConfirmModal } from "@/app/_components/ConfirmModal";
import ToastContainer from "@/app/_components/ToastContainer";
import { useToastStore } from "@/lib/store/toastStore";

const STATUS_STYLE: Record<DrawingStatus, { bg: string; color: string; border: string }> = {
  [DrawingStatus.Draft]:      { bg: "var(--bg3)",          color: "var(--text2)",   border: "var(--border)" },
  [DrawingStatus.InProgress]: { bg: "#e8f0fe",              color: "#1a56db",        border: "#a4c0f4" },
  [DrawingStatus.Approved]:   { bg: "var(--success-dim)",  color: "var(--success)", border: "rgba(15,123,69,0.2)" },
};

function StatusBadge({ status }: { status: DrawingStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {DRAWING_STATUS_LABELS[status]}
    </span>
  );
}

function fmtDate(value: string) {
  if (!value) return "—";
  const [y, m, day] = value.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

function fileIcon(contentType: string) {
  if (contentType.includes("pdf")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
  if (contentType.includes("image")) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

type MergedRow =
  | { kind: "drawing"; drawing: TechnicalDrawingResponse }
  | { kind: "empty"; contract: ContractResponse };

export default function TechnicalDrawingsPage() {
  const showToast = useToastStore((s) => s.show);
  const [list, setList] = useState<TechnicalDrawingResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drawer
  const [drawer, setDrawer] = useState<TechnicalDrawingResponse | null>(null);
  const [drawerFiles, setDrawerFiles] = useState<AttachmentResponse[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createContract, setCreateContract] = useState<ContractResponse | null>(null);
  const [createForm, setCreateForm] = useState({ title: "", notes: "" });
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);

  // Edit form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TechnicalDrawingResponse | null>(null);
  const [editForm, setEditForm] = useState({ title: "", notes: "" });
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [drawings, contractList] = await Promise.all([
      technicalDrawingService.getAll(),
      contractService.getAll(),
    ]);
    setList(drawings);
    setContracts(contractList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const mergedRows = useMemo((): MergedRow[] => {
    const rows: MergedRow[] = [];
    for (const contract of contracts) {
      const drawings = list.filter((d) => d.contractId === contract.id);
      if (drawings.length === 0) {
        rows.push({ kind: "empty", contract });
      } else {
        for (const d of drawings) {
          rows.push({ kind: "drawing", drawing: d });
        }
      }
    }
    for (const d of list) {
      if (!contracts.some((c) => c.id === d.contractId)) {
        rows.push({ kind: "drawing", drawing: d });
      }
    }
    return rows;
  }, [contracts, list]);

  const filtered = useMemo((): MergedRow[] => {
    const q = search.trim().toLowerCase();
    return mergedRows.filter((row) => {
      const contractNo = row.kind === "drawing"
        ? row.drawing.contractNo.toLowerCase()
        : row.contract.contractNo.toLowerCase();
      const matchSearch =
        q.length === 0 ||
        contractNo.includes(q) ||
        (row.kind === "drawing" && row.drawing.title.toLowerCase().includes(q));

      if (filterStatus === "no_drawing") return matchSearch && row.kind === "empty";

      const statusNum = filterStatus !== "" ? Number(filterStatus) : null;
      if (statusNum !== null && row.kind === "empty") return false;
      const matchStatus = statusNum === null || (row.kind === "drawing" && row.drawing.status === statusNum);

      return matchSearch && matchStatus;
    });
  }, [mergedRows, search, filterStatus]);

  const openDrawer = async (item: TechnicalDrawingResponse) => {
    setDrawer(item);
    setDrawerFiles([]);
    setDrawerLoading(true);
    try {
      const files = await technicalDrawingService.getFiles(item.id);
      setDrawerFiles(files);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await technicalDrawingService.delete(deleteId);
      await loadData();
      showToast("Texnik chizma o'chirildi.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const openCreate = (contract: ContractResponse) => {
    setCreateContract(contract);
    setCreateForm({ title: "", notes: "" });
    setCreateSubmitted(false);
    window.history.pushState({ showCreateForm: true }, "");
    setShowCreateForm(true);
  };

  const handleCreateSave = async () => {
    setCreateSubmitted(true);
    if (!createForm.title.trim()) return;
    setCreateSaving(true);
    try {
      await technicalDrawingService.create({
        contractId: createContract!.id,
        title: createForm.title.trim(),
        notes: createForm.notes.trim() || null,
      });
      await loadData();
      setShowCreateForm(false);
      showToast("Texnik chizma muvaffaqiyatli yaratildi!");
    } finally {
      setCreateSaving(false);
    }
  };

  useEffect(() => {
    if (!showCreateForm) return;
    const handlePopState = () => setShowCreateForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showCreateForm]);

  useEffect(() => {
    if (!showEditForm) return;
    const handlePopState = () => setShowEditForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showEditForm]);

  const openEdit = (item: TechnicalDrawingResponse) => {
    setEditTarget(item);
    setEditForm({ title: item.title, notes: item.notes || "" });
    setEditSubmitted(false);
    setDrawer(null);
    window.history.pushState({ showEditForm: true }, "");
    setShowEditForm(true);
  };

  const handleEditSave = async () => {
    setEditSubmitted(true);
    if (!editForm.title.trim()) return;
    setEditSaving(true);
    try {
      await technicalDrawingService.update(editTarget!.id, {
        title: editForm.title.trim(),
        notes: editForm.notes.trim() || null,
      });
      await loadData();
      setShowEditForm(false);
      showToast("Texnik chizma muvaffaqiyatli yangilandi!");
    } finally {
      setEditSaving(false);
    }
  };

  if (showCreateForm && createContract) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>Yangi texnik chizma</span>
        </div>

        <div className="itm-card" style={{ padding: 32, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 600 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>Shartnoma</label>
              <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, color: "var(--text1)", fontWeight: 600 }}>
                {createContract.contractNo}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: createSubmitted && !createForm.title.trim() ? "var(--danger)" : "var(--text2)" }}>
                Nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Texnik chizma nomi"
                autoFocus
                style={{ height: 44, fontSize: 14, ...(createSubmitted && !createForm.title.trim() ? { borderColor: "var(--danger)" } : {}) }}
              />
              {createSubmitted && !createForm.title.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Nomi kiritish shart</div>}
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>Izoh</label>
              <textarea
                className="form-input"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={6}
                placeholder="Qo'shimcha izoh (ixtiyoriy)"
                style={{ fontSize: 14, resize: "none" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={() => setShowCreateForm(false)} style={{ fontSize: 13, padding: "10px 20px" }}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={handleCreateSave} disabled={createSaving} style={{ fontSize: 13, padding: "10px 22px" }}>
              {createSaving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showEditForm && editTarget) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>Texnik chizmani tahrirlash</span>
        </div>

        <div className="itm-card" style={{ padding: 32, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 600 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>Shartnoma</label>
              <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, color: "var(--text1)", fontWeight: 600 }}>
                {editTarget.contractNo}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: editSubmitted && !editForm.title.trim() ? "var(--danger)" : "var(--text2)" }}>
                Nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Texnik chizma nomi"
                style={{ height: 44, fontSize: 14, ...(editSubmitted && !editForm.title.trim() ? { borderColor: "var(--danger)" } : {}) }}
              />
              {editSubmitted && !editForm.title.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Nomi kiritish shart</div>}
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>Izoh</label>
              <textarea
                className="form-input"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={6}
                placeholder="Qo'shimcha izoh (ixtiyoriy)"
                style={{ fontSize: 14, resize: "none" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={() => setShowEditForm(false)} style={{ fontSize: 13, padding: "10px 20px" }}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving} style={{ fontSize: 13, padding: "10px 22px" }}>
              {editSaving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16, fontFamily: "Inter, sans-serif" }}>
        {/* Filter bar */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, padding: "10px 14px", flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
            <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              placeholder="Qidirish: nomi, shartnoma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 175, height: 36, cursor: "pointer", padding: "0 10px" }}>
            <option value="">Barcha statuslar</option>
            <option value="no_drawing">Chizma yo&apos;q</option>
            <option value={String(DrawingStatus.Draft)}>Qoralama</option>
            <option value={String(DrawingStatus.InProgress)}>Jarayonda</option>
            <option value={String(DrawingStatus.Approved)}>Tasdiqlangan</option>
          </select>

          <button className="btn-icon" onClick={loadData} title="Yangilash" style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23,4 23,10 17,10" />
              <polyline points="1,20 1,14 7,14" />
              <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="itm-card" style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="itm-table">
                <thead>
                  <tr>
                    <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Shartnoma</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Nomi</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Yaratuvchi</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Status</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Faollik</th>
                    <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Sana</th>
                    <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px 14px", color: "var(--text3)" }}>
                        Ma&apos;lumot topilmadi
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => {
                      if (row.kind === "empty") {
                        const c = row.contract;
                        return (
                          <tr key={`empty-${c.id}`}>
                            <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)" }}>{c.contractNo}</td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ textAlign: "center" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", padding: "2px 10px",
                                borderRadius: 20, fontSize: 12, fontWeight: 600,
                                background: "var(--danger-dim)", color: "var(--danger)",
                                border: "1px solid var(--danger)33",
                              }}>
                                Chizma yo&apos;q
                              </span>
                            </td>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 13 }}>—</td>
                            <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)" }}>{fmtDate(c.createdAt)}</td>
                            <td style={{ borderLeft: "2px solid var(--border)" }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                <button
                                  className="btn-icon"
                                  onClick={() => openCreate(c)}
                                  title="Chizma yaratish"
                                  style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)", width: 28, height: 28, fontSize: 18, fontWeight: 400 }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const item = row.drawing;
                      return (
                        <tr key={item.id}>
                          <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => openDrawer(item)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "Inter, sans-serif" }}
                            >
                              {item.contractNo}
                            </button>
                          </td>
                          <td style={{ textAlign: "center", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text1)" }}>{item.title}</td>
                          <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.createdByFullName ?? "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", padding: "2px 10px",
                              borderRadius: 20, fontSize: 13, fontWeight: 600,
                              background: item.isActive ? "#dcfce7" : "var(--danger-dim)",
                              color: item.isActive ? "#16a34a" : "var(--danger)",
                              border: `1px solid ${item.isActive ? "#86efac" : "var(--danger)"}`,
                            }}>
                              {item.isActive ? "Faol" : "Nofaol"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontSize: 13, color: "var(--text1)", fontFamily: "Inter, sans-serif" }}>
                            {fmtDate(item.createdAt)}
                          </td>
                          <td style={{ borderLeft: "2px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                className="btn-icon"
                                onClick={() => openDrawer(item)}
                                title="Ko'rish"
                                style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => openEdit(item)}
                                title="Tahrirlash"
                                style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => setDeleteId(item.id)}
                                title="O'chirish"
                                style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer ── */}
      {drawer && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setDrawer(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
              padding: "28px 28px 32px", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 0,
            }}
          >
            {/* Sticky header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "sticky", top: 0, background: "var(--bg2)", zIndex: 1, paddingBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>
                Texnik chizma tafsilotlari
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn-icon"
                  onClick={() => openEdit(drawer)}
                  title="Tahrirlash"
                  style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDrawer(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}
                >✕</button>
              </div>
            </div>

            {/* Info cards */}
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Shartnoma</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", fontFamily: "Inter, sans-serif" }}>{drawer.contractNo}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Status</div>
                <StatusBadge status={drawer.status} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Yaratilgan</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text1)" }}>{fmtDate(drawer.createdAt)}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Yaratuvchi</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text1)" }}>{drawer.createdByFullName ?? "—"}</div>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Nomi</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>{drawer.title}</div>
            </div>

            {/* Notes */}
            {drawer.notes && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
                <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{drawer.notes}</div>
              </div>
            )}

            {/* Files section */}
            <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 14 }}>
                Fayllar {drawerFiles.length > 0 ? `(${drawerFiles.length})` : ""}
              </div>

              {drawerLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "16px 0" }}>Yuklanmoqda...</div>
              ) : drawerFiles.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "28px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                  Fayllar yo&apos;q
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {drawerFiles.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        border: "1.5px solid var(--border)", borderRadius: 8,
                        padding: "10px 14px", background: "var(--bg1)",
                      }}
                    >
                      <div style={{ flexShrink: 0 }}>{fileIcon(file.contentType)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {file.fileName}
                        </div>
                      </div>
                      <button
                        onClick={() => technicalDrawingService.downloadFile(drawer.id, file.id, file.fileName)}
                        title="Yuklab olish"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                          color: "var(--accent)", border: "1.5px solid var(--accent)33", background: "var(--accent-dim)",
                          cursor: "pointer",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="O'chirishni tasdiqlang"
        message="Texnik chizmani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        cancelLabel="Bekor qilish"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ToastContainer />
    </>
  );
}
