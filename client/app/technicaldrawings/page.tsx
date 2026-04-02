"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import {
  technicalDrawingService,
  contractService,
  DrawingStatus,
  DRAWING_STATUS_LABELS,
  type TechnicalDrawingResponse,
  type ContractResponse,
} from "@/lib/userService";

const STATUS_STYLE: Record<DrawingStatus, { bg: string; color: string; border: string }> = {
  [DrawingStatus.Draft]:    { bg: "var(--bg3)",          color: "var(--text2)",   border: "var(--border)" },
  [DrawingStatus.Approved]: { bg: "var(--success-dim)",  color: "var(--success)", border: "rgba(15,123,69,0.2)" },
};

function StatusBadge({ status }: { status: DrawingStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
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

export default function TechnicalDrawingsPage() {
  const [list, setList] = useState<TechnicalDrawingResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [form, setForm] = useState({
    contractId: "",
    title: "",
    notes: "",
    file: null as File | null,
  });

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statusNum = filterStatus !== "" ? Number(filterStatus) : null;
    return list.filter((item) => {
      const matchSearch =
        q.length === 0 ||
        item.contractNo.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q);
      const matchStatus = statusNum === null || item.status === statusNum;
      return matchSearch && matchStatus;
    });
  }, [list, search, filterStatus]);

  useDraft<{ contractId: string; title: string; notes: string }>(
    "draft_technicaldrawings",
    showForm,
    { contractId: form.contractId, title: form.title, notes: form.notes },
    (d) => { setForm({ contractId: d.contractId, title: d.title, notes: d.notes, file: null }); setShowForm(true); },
  );

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => setShowForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  const openCreate = () => {
    setForm({ contractId: "", title: "", notes: "", file: null });
    setSubmitted(false);
    setFileError("");
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await technicalDrawingService.updateStatus(id, DrawingStatus.Approved);
      setList((prev) => prev.map((t) => t.id === id ? { ...t, status: DrawingStatus.Approved } : t));
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await technicalDrawingService.delete(deleteId);
      setList((prev) => prev.filter((t) => t.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    setSubmitted(true);
    setFileError("");

    if (!form.contractId || !form.title.trim()) return;
    if (!form.file) {
      setFileError("Texnik chizmalari faylini yuklash shart.");
      return;
    }

    setSaving(true);
    try {
      const newId = await technicalDrawingService.create({
        contractId: form.contractId,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
      });

      if (form.file) {
        await technicalDrawingService.uploadFile(newId, form.file);
      }

      await loadData();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 140px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 24, color: "var(--text1)" }}>Yangi texnik chizma</span>
        </div>

        <div className="itm-card" style={{ padding: 32, flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 24, alignItems: "stretch", minHeight: "70vh" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
              <div>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.contractId ? "var(--danger)" : "var(--text2)" }}>
                  Shartnomani tanlang <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={form.contractId}
                  onChange={(e) => setForm((p) => ({ ...p, contractId: e.target.value }))}
                  style={{ width: "100%", height: 52, fontSize: 15, ...(submitted && !form.contractId ? { borderColor: "var(--danger)" } : {}) }}
                >
                  <option value="">— Shartnomani tanlang —</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractNo}
                    </option>
                  ))}
                </select>
                {submitted && !form.contractId && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>Shartnoma tanlash shart</div>}
              </div>

              <div>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.title.trim() ? "var(--danger)" : "var(--text2)" }}>
                  Sarlavha <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Masalan: Texnik chizma 01"
                  style={{ height: 52, fontSize: 15, ...(submitted && !form.title.trim() ? { borderColor: "var(--danger)" } : {}) }}
                />
                {submitted && !form.title.trim() && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>Sarlavha kiritish shart</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: "var(--text2)" }}>
                  Izoh
                </label>
                <textarea
                  className="form-input"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={12}
                  placeholder="Qo'shimcha izoh (ixtiyoriy)"
                  style={{ fontSize: 15, resize: "none", flex: 1, minHeight: 0, paddingTop: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <label style={{ fontSize: 16, fontWeight: 700, display: "block", marginBottom: 8, color: submitted && !form.file ? "var(--danger)" : "var(--text2)" }}>
                Texnik chizmalari <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 10 }}>
                Texnik chizmalari faylini shu yerga yuklang
              </div>
              <label
                htmlFor="technical-drawing-file"
                style={{
                  flex: 1,
                  minHeight: 0,
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  background: "var(--bg1)",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  gap: 10,
                }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)" }}>
                  Faylni tanlash
                </div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                  PDF, DWG, DXF yoki boshqa texnik chizma fayli
                </div>
                {form.file && (
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "var(--accent)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.file.name}
                  </div>
                )}
                <input
                  id="technical-drawing-file"
                  type="file"
                  hidden
                  onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                />
              </label>
              {fileError && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{fileError}</div>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ fontSize: 14, padding: "11px 18px" }}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ fontSize: 14, padding: "11px 20px" }}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg width="16" height="16" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Qidirish: sarlavha, shartnoma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 170, height: 36, cursor: "pointer", padding: "0 10px" }}>
          <option value="">Barcha statuslar</option>
          <option value={String(DrawingStatus.Draft)}>Qoralama</option>
          <option value={String(DrawingStatus.Approved)}>Tasdiqlangan</option>
        </select>

        <button className="btn-icon" onClick={loadData} title="Yangilash" style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="23,4 23,10 17,10" />
            <polyline points="1,20 1,14 7,14" />
            <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        <button className="btn-primary" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yangi yaratish
        </button>
      </div>

      <div className="itm-card" style={{ flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="itm-table">
            <thead>
              <tr>
                <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Shartnoma</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Sarlavha</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Yaratuvchi</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Status</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Sana</th>
                <th style={{ textAlign: "center", color: "var(--text1)", textTransform: "none" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px 14px", color: "var(--text3)" }}>
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px 14px", color: "var(--text3)" }}>
                    Ma&apos;lumot topilmadi
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", color: "var(--text2)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.contractNo}</td>
                    <td style={{ textAlign: "center", fontSize: 14, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</td>
                    <td style={{ textAlign: "center", fontSize: 13, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.createdByFullName ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ textAlign: "center", fontSize: 13 }}>{fmtDate(item.createdAt)}</td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {item.status === DrawingStatus.Draft && (
                          <button
                            className="btn-icon"
                            onClick={() => handleApprove(item.id)}
                            disabled={approvingId === item.id}
                            title="Tasdiqlash"
                            style={{ color: "var(--success)", borderColor: "rgba(15,123,69,0.25)", background: "var(--success-dim)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => setDeleteId(item.id)}
                          title="O'chirish"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>O&apos;chirishni tasdiqlang</div>
            <div style={{ fontSize: 14, color: "var(--text2)" }}>Bu texnik chizmani o&apos;chirmoqchimisiz? Bu amalni ortga qaytarib bo&apos;lmaydi.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-outline" style={{ fontSize: 13, padding: "9px 18px" }}>
                Bekor qilish
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: "9px 20px", background: "var(--danger)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
