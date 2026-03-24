"use client";

import { useEffect, useState } from "react";
import {
  contractService,
  ContractStatus,
  Priority,
  CONTRACT_STATUS_LABELS,
  PRIORITY_LABELS,
  type ContractResponse,
  type ContractCreatePayload,
  type ContractUpdatePayload,
} from "@/lib/userService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractForm {
  contractNo: string;
  startDate: string;
  endDate: string;
  priority: string;
  notes: string;
}

const emptyForm: ContractForm = {
  contractNo: "", startDate: "", endDate: "",
  priority: String(Priority.Medium), notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ContractStatus, { bg: string; color: string; border: string }> = {
  [ContractStatus.Draft]:     { bg: "var(--bg3)",        color: "var(--text2)",    border: "var(--border)" },
  [ContractStatus.Active]:    { bg: "#e6f4ea",           color: "#1e7e34",         border: "#a8d5b5" },
  [ContractStatus.Completed]: { bg: "#e8f0fe",           color: "#1a56db",         border: "#a4c0f4" },
  [ContractStatus.Cancelled]: { bg: "var(--danger-dim)", color: "var(--danger)",   border: "var(--danger)" },
};

const PRIORITY_STYLE: Record<Priority, { color: string }> = {
  [Priority.Low]:    { color: "var(--text2)" },
  [Priority.Medium]: { color: "#d97706" },
  [Priority.High]:   { color: "#dc2626" },
  [Priority.Urgent]: { color: "#7c3aed" },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function fmt(d: string) {
  return d ? d.slice(0, 10).split("-").reverse().join(".") : "—";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [contracts, setContracts]       = useState<ContractResponse[]>([]);
  const [filtered, setFiltered]         = useState<ContractResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  // Filters
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Form
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<ContractResponse | null>(null);
  const [form, setForm]                 = useState<ContractForm>(emptyForm);
  const [submitted, setSubmitted]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState("");

  // View drawer
  const [viewContract, setViewContract] = useState<ContractResponse | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Status change
  const [statusTarget, setStatusTarget] = useState<ContractResponse | null>(null);
  const [newStatus, setNewStatus]       = useState<string>("");
  const [changingStatus, setChangingStatus] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await contractService.getAll();
      setContracts(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      contracts.filter(c => {
        const matchSearch = !q || c.contractNo.toLowerCase().includes(q);
        const matchStatus = filterStatus === "" || c.status === Number(filterStatus);
        return matchSearch && matchStatus;
      })
    );
  }, [search, filterStatus, contracts]);

  // ── Form ──────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setSubmitted(false);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (c: ContractResponse) => {
    setEditTarget(c);
    setForm({
      contractNo:   c.contractNo,
      startDate:    c.startDate.slice(0, 10),
      endDate:      c.endDate.slice(0, 10),
      priority:     String(c.priority),
      notes:        c.notes ?? "",
    });
    setSubmitted(false);
    setFormError("");
    setShowForm(true);
  };

  const isValid = () =>
    form.contractNo.trim() && form.startDate && form.endDate;

  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid()) return;
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        const dto: ContractUpdatePayload = {
          contractNo:   form.contractNo,
          startDate:    form.startDate,
          endDate:      form.endDate,
          priority:     Number(form.priority) as Priority,
          notes:        form.notes || null,
        };
        await contractService.update(editTarget.id, dto);
      } else {
        const dto: ContractCreatePayload = {
          contractNo:   form.contractNo,
          startDate:    form.startDate,
          endDate:      form.endDate,
          priority:     Number(form.priority) as Priority,
          notes:        form.notes || null,
        };
        await contractService.create(dto);
      }
      await load();
      setShowForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await contractService.delete(deleteId);
      setContracts(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
    } catch {
      // stay open
    } finally {
      setDeleting(false);
    }
  };

  // ── Status Change ─────────────────────────────────────────────────────────

  const handleStatusChange = async () => {
    if (!statusTarget || newStatus === "") return;
    setChangingStatus(true);
    try {
      await contractService.updateStatus(statusTarget.id, Number(newStatus) as ContractStatus);
      setContracts(prev =>
        prev.map(c => c.id === statusTarget.id ? { ...c, status: Number(newStatus) as ContractStatus } : c)
      );
      setStatusTarget(null);
    } catch {
      // stay open
    } finally {
      setChangingStatus(false);
    }
  };

  // ── Render: Form ──────────────────────────────────────────────────────────

  const fieldErr = (val: string) => submitted && !val.trim();

  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>
            {editTarget ? "Shartnomani tahrirlash" : "Yangi shartnoma"}
          </span>
        </div>

        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Shartnoma raqami */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.contractNo) ? "var(--danger)" : "var(--text2)" }}>
                Shartnoma raqami <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.contractNo}
                onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                placeholder="SH-2025-001"
                style={fieldErr(form.contractNo) ? { borderColor: "var(--danger)" } : undefined}
              />
              {fieldErr(form.contractNo) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Shartnoma raqamini kiriting</div>}
            </div>

            {/* Boshlanish sanasi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: submitted && !form.startDate ? "var(--danger)" : "var(--text2)" }}>
                Boshlanish sanasi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                style={submitted && !form.startDate ? { borderColor: "var(--danger)" } : undefined}
              />
            </div>

            {/* Tugash sanasi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: submitted && !form.endDate ? "var(--danger)" : "var(--text2)" }}>
                Tugash sanasi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                style={submitted && !form.endDate ? { borderColor: "var(--danger)" } : undefined}
              />
            </div>

            {/* Muhimlik */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Muhimlik</label>
              <select className="form-input" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: "100%", cursor: "pointer" }}>
                {(Object.keys(PRIORITY_LABELS) as unknown as Priority[]).map(k => (
                  <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {/* Izoh */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Izoh</label>
              <textarea className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Qo'shimcha izoh (ixtiyoriy)" rows={3} style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
            {formError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
          <button onClick={() => setShowForm(false)}
            style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Saqlanmoqda..." : editTarget ? "O'zgarishlarni saqlash" : "Shartnoma saqlash"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Filter bar */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish (raqam)"
            value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#fff" }} />
        </div>

        <select className="form-input" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 160, cursor: "pointer", height: 36, padding: "0 10px", background: "#fff" }}>
          <option value="">Barcha holat</option>
          {(Object.keys(CONTRACT_STATUS_LABELS) as unknown as ContractStatus[]).map(k => (
            <option key={k} value={k}>{CONTRACT_STATUS_LABELS[k]}</option>
          ))}
        </select>

        <button className="btn-icon" onClick={load} title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        <button className="btn-primary" onClick={openCreate}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yangi shartnoma
        </button>
      </div>

      {/* Table */}
      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Raqam</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Muddat</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Muhimlik</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Holat</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <button onClick={() => setViewContract(c)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                        {c.contractNo}
                      </button>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {fmt(c.startDate)} – {fmt(c.endDate)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><PriorityBadge priority={c.priority} /></td>
                    <td style={{ textAlign: "center", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <button onClick={() => { setStatusTarget(c); setNewStatus(String(c.status)); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        <StatusBadge status={c.status} />
                      </button>
                    </td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" onClick={() => setViewContract(c)} title="Ko'rish"
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button className="btn-icon" onClick={() => openEdit(c)} title="Tahrirlash"
                          style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={() => setDeleteId(c.id)} title="O'chirish"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Drawer ── */}
      {viewContract && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setViewContract(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 800, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
              padding: "28px 28px 32px", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Shartnoma tafsilotlari</span>
              <button onClick={() => setViewContract(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma raqami</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "var(--font-mono)", wordBreak: "break-all", overflowWrap: "break-word" }}>{viewContract.contractNo}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Holat</div>
                <StatusBadge status={viewContract.status} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Muhimlik</div>
                <PriorityBadge priority={viewContract.priority} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Boshlanish sanasi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.startDate)}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Tugash sanasi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(viewContract.endDate)}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratuvchi</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{viewContract.createdByFullName ?? "—"}</div>
              </div>
            </div>

            {viewContract.notes && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
                <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewContract.notes}</div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Status Change Modal ── */}
      {statusTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setStatusTarget(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Holat o&apos;zgartirish</div>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>
              <b>{statusTarget.contractNo}</b> — holat tanlang:
            </div>
            <select className="form-input" value={newStatus} onChange={e => setNewStatus(e.target.value)}
              style={{ width: "100%", cursor: "pointer" }}>
              {(Object.keys(CONTRACT_STATUS_LABELS) as unknown as ContractStatus[]).map(k => (
                <option key={k} value={k}>{CONTRACT_STATUS_LABELS[k]}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setStatusTarget(null)}
                style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
                Bekor
              </button>
              <button className="btn-primary" onClick={handleStatusChange} disabled={changingStatus}
                style={{ padding: "9px 20px", borderRadius: "var(--radius)" }}>
                {changingStatus ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Shartnomani o&apos;chirish</div>
            <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              Bu shartnoma o&apos;chiriladi. Amalni ortga qaytarib bo&apos;lmaydi.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)}
                style={{ padding: "9px 20px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
                Bekor
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: "9px 20px", background: "var(--danger)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
