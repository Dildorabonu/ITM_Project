"use client";

import { useEffect, useMemo, useState } from "react";
import {
  technicalDrawingService,
  contractService,
  DrawingStatus,
  type TechnicalDrawingResponse,
  type ContractResponse,
  type AttachmentResponse,
} from "@/lib/userService";

import { ConfirmModal } from "@/app/_components/ConfirmModal";
import { useToastStore } from "@/lib/store/toastStore";

import { type MergedRow, type DrawingFormValues, emptyDrawingForm } from "./_types";
import { StatusBadge } from "./_components/StatusBadge";
import { DrawingForm } from "./_components/DrawingForm";
import { DrawingDrawer } from "./_components/DrawingDrawer";

function fmtDate(value: string) {
  if (!value) return "—";
  const [y, m, day] = value.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

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
  const [createForm, setCreateForm] = useState<DrawingFormValues>(emptyDrawingForm);
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);

  // Approve
  const [approving, setApproving] = useState(false);

  // Edit form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TechnicalDrawingResponse | null>(null);
  const [editForm, setEditForm] = useState<DrawingFormValues>(emptyDrawingForm);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

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

  // ── Rows ──────────────────────────────────────────────────────────────────

  const mergedRows = useMemo((): MergedRow[] => {
    const rows: MergedRow[] = [];
    for (const contract of contracts) {
      const drawings = list.filter((d) => d.contractId === contract.id);
      if (drawings.length === 0) {
        rows.push({ kind: "empty", contract });
      } else {
        rows.push({ kind: "drawing", drawing: drawings[0] });
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

  // ── Drawer ────────────────────────────────────────────────────────────────

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

  // ── Delete ────────────────────────────────────────────────────────────────

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

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = (contract: ContractResponse) => {
    const alreadyExists = list.some((d) => d.contractId === contract.id);
    if (alreadyExists) return;
    setCreateContract(contract);
    setCreateForm(emptyDrawingForm);
    setCreateSubmitted(false);
    window.history.pushState(null, "");
    setShowCreateForm(true);
  };

  const handleCreateSave = async () => {
    setCreateSubmitted(true);
    if (!createForm.title.trim()) return;
    setCreateSaving(true);
    try {
      const newId = await technicalDrawingService.create({
        contractId: createContract!.id,
        title: createForm.title.trim(),
        notes: createForm.notes.trim() || null,
      });
      if (createForm.files.length > 0) {
        await Promise.all(createForm.files.map((f) => technicalDrawingService.uploadFile(newId, f)));
      }
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

  // ── Approve ───────────────────────────────────────────────────────────────

  const handleApprove = async (item: TechnicalDrawingResponse) => {
    setApproving(true);
    try {
      await technicalDrawingService.updateStatus(item.id, DrawingStatus.Approved);
      await loadData();
      setDrawer(null);
      showToast("Texnik chizma tasdiqlandi!");
    } finally {
      setApproving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = (item: TechnicalDrawingResponse) => {
    setEditTarget(item);
    setEditForm({ title: item.title, notes: item.notes || "", files: [] });
    setEditSubmitted(false);
    setDrawer(null);
    window.history.pushState(null, "");
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
      if (editForm.files.length > 0) {
        await Promise.all(editForm.files.map((f) => technicalDrawingService.uploadFile(editTarget!.id, f)));
      }
      await loadData();
      setShowEditForm(false);
      showToast("Texnik chizma muvaffaqiyatli yangilandi!");
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    if (!showEditForm) return;
    const handlePopState = () => setShowEditForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showEditForm]);

  // ── Render: Create form ───────────────────────────────────────────────────

  if (showCreateForm && createContract) {
    return (
      <DrawingForm
        mode="create"
        contract={createContract}
        form={createForm}
        setForm={setCreateForm}
        submitted={createSubmitted}
        saving={createSaving}
        onSave={handleCreateSave}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  // ── Render: Edit form ─────────────────────────────────────────────────────

  if (showEditForm && editTarget) {
    return (
      <DrawingForm
        mode="edit"
        contract={{ contractNo: editTarget.contractNo }}
        form={editForm}
        setForm={setEditForm}
        submitted={editSubmitted}
        saving={editSaving}
        onSave={handleEditSave}
        onCancel={() => setShowEditForm(false)}
      />
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
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

          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 175, height: 36, cursor: "pointer", padding: "0 10px" }}
          >
            <option value="">Barcha statuslar</option>
            <option value="no_drawing">Chizma yo&apos;q</option>
            <option value={String(DrawingStatus.Draft)}>Qoralama</option>
            <option value={String(DrawingStatus.InProgress)}>Jarayonda</option>
            <option value={String(DrawingStatus.Approved)}>Tasdiqlangan</option>
          </select>

          <button
            className="btn-icon"
            onClick={loadData}
            title="Yangilash"
            style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
          >
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
                                  style={{ color: "var(--accent)", borderColor: "var(--accent)33", background: "var(--accent-dim)", width: 28, height: 28, fontSize: 18, fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
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
                          <td style={{ textAlign: "center", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text1)" }}>
                            {item.title}
                          </td>
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
                              {item.status !== DrawingStatus.Approved && (
                                <button
                                  className="btn-icon"
                                  onClick={() => handleApprove(item)}
                                  title="Tasdiqlash"
                                  disabled={approving}
                                  style={{ color: "#f59e0b", borderColor: "#f59e0b33", background: "#f59e0b12" }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </button>
                              )}
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

      {/* Drawer */}
      {drawer && (
        <DrawingDrawer
          drawer={drawer}
          drawerFiles={drawerFiles}
          drawerLoading={drawerLoading}
          onClose={() => setDrawer(null)}
          onEdit={openEdit}
          onApprove={handleApprove}
          approving={approving}
        />
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

    </div>
  );
}
