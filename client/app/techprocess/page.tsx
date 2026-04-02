"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import {
  techProcessService,
  contractService,
  ProcessStatus,
  PROCESS_STATUS_LABELS,
  type TechProcessResponse,
  type TechProcessCreatePayload,
  type ContractResponse,
} from "@/lib/userService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ProcessStatus, { bg: string; color: string; border: string }> = {
  [ProcessStatus.Pending]:    { bg: "var(--bg3)",        color: "var(--text2)",  border: "var(--border)" },
  [ProcessStatus.InProgress]: { bg: "#e8f0fe",           color: "#1a56db",       border: "#a4c0f4" },
  [ProcessStatus.Approved]:   { bg: "var(--success-dim)",color: "var(--success)",border: "rgba(15,123,69,0.2)" },
  [ProcessStatus.Rejected]:   { bg: "var(--danger-dim)", color: "var(--danger)", border: "var(--danger)" },
  [ProcessStatus.Completed]:  { bg: "var(--purple-dim)", color: "var(--purple)", border: "rgba(109,74,173,0.2)" },
};

function StatusBadge({ status }: { status: ProcessStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {PROCESS_STATUS_LABELS[status]}
    </span>
  );
}

function fmt(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechProcessPage() {
  const [list, setList]           = useState<TechProcessResponse[]>([]);
  const [filtered, setFiltered]   = useState<TechProcessResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drawer
  const [drawer, setDrawer]       = useState<TechProcessResponse | null>(null);

  // Create form
  const [showForm, setShowForm]   = useState(false);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [form, setForm]           = useState({ contractId: "", title: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [finalContractFile, setFinalContractFile] = useState<File | null>(null);
  const [templateContractFile, setTemplateContractFile] = useState<File | null>(null);
  const [fileSubmitError, setFileSubmitError] = useState("");

  // Drawer edit
  const [drawerEditing, setDrawerEditing] = useState(false);
  const [drawerEditForm, setDrawerEditForm] = useState({ title: "", notes: "" });
  const [drawerEditSaving, setDrawerEditSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // Action buttons
  const [approving, setApproving]             = useState(false);
  const [approvingId, setApprovingId]         = useState<string | null>(null);
  const [sendingWarehouse, setSendingWarehouse] = useState(false);

  useDraft(
    "draft_techprocess",
    showForm,
    form,
    (d) => {
      setForm(d);
      setShowForm(true);
      contractService.getAll().then(setContracts).catch(() => {});
    },
  );

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await techProcessService.getAll();
      setList(data);
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      list.filter(t => {
        const matchSearch = !q ||
          t.title.toLowerCase().includes(q) ||
          t.contractNo.toLowerCase().includes(q);
        const matchStatus = filterStatus === "" || t.status === Number(filterStatus);
        return matchSearch && matchStatus;
      })
    );
  }, [search, filterStatus, list]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => setShowForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  // ── Drawer ──────────────────────────────────────────────────────────────────

  const openDrawer = async (tp: TechProcessResponse) => {
    setDrawer(tp);
    setDrawerEditing(false);
    const fresh = await techProcessService.getById(tp.id);
    setDrawer(fresh);
  };

  const openDrawerEdit = async (tp: TechProcessResponse) => {
    setDrawer(tp);
    setDrawerEditing(true);
    setDrawerEditForm({ title: tp.title, notes: tp.notes || "" });
    const fresh = await techProcessService.getById(tp.id);
    setDrawer(fresh);
    setDrawerEditForm({ title: fresh.title, notes: fresh.notes || "" });
  };

  const handleDrawerEditSave = async () => {
    if (!drawer) return;
    setDrawerEditSaving(true);
    try {
      await techProcessService.update(drawer.id, {
        title: drawerEditForm.title,
        notes: drawerEditForm.notes || null,
      });
      await refreshDrawer(drawer.id);
      setDrawerEditing(false);
    } catch {
      // silently fail
    } finally {
      setDrawerEditSaving(false);
    }
  };

  const refreshDrawer = async (id: string) => {
    const fresh = await techProcessService.getById(id);
    setDrawer(fresh);
    setList(prev => prev.map(t => t.id === id ? fresh : t));
  };

  // ── Create form ─────────────────────────────────────────────────────────────

  const openCreate = async () => {
    setForm({ contractId: "", title: "", notes: "" });
    setSubmitted(false);
    setFormError("");
    setFinalContractFile(null);
    setTemplateContractFile(null);
    setFileSubmitError("");
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
    if (contracts.length === 0) {
      const data = await contractService.getAll();
      setContracts(data);
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    setFileSubmitError("");
    if (!form.contractId || !form.title.trim()) return;
    if (!finalContractFile || !templateContractFile) {
      setFileSubmitError("Asl va template shartnoma fayllarini yuklang.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await Promise.all([
        contractService.uploadFile(form.contractId, finalContractFile),
        contractService.uploadFile(form.contractId, templateContractFile),
      ]);

      const dto: TechProcessCreatePayload = {
        contractId: form.contractId,
        title: form.title.trim(),
        notes: form.notes || null,
      };
      const newId = await techProcessService.create(dto);
      const fresh = await techProcessService.getById(newId);
      setList(prev => [fresh, ...prev]);
      setShowForm(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await techProcessService.delete(deleteId);
      setList(prev => prev.filter(t => t.id !== deleteId));
      if (drawer?.id === deleteId) setDrawer(null);
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Approve / Send to warehouse ──────────────────────────────────────────────

  const handleApprove = async () => {
    if (!drawer) return;
    setApproving(true);
    try {
      await techProcessService.approve(drawer.id);
      await refreshDrawer(drawer.id);
    } finally {
      setApproving(false);
    }
  };

  const handleApproveRow = async (id: string) => {
    setApprovingId(id);
    try {
      await techProcessService.approve(id);
      const fresh = await techProcessService.getById(id);
      setList(prev => prev.map(t => t.id === id ? fresh : t));
    } finally {
      setApprovingId(null);
    }
  };

  const handleSendToWarehouse = async () => {
    if (!drawer) return;
    setSendingWarehouse(true);
    try {
      await techProcessService.sendToWarehouse(drawer.id);
      await refreshDrawer(drawer.id);
    } finally {
      setSendingWarehouse(false);
    }
  };

  // ── Render: Form ─────────────────────────────────────────────────────────────

  if (showForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi texnologik jarayon</span>
        </div>

        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>

            {/* Shartnoma + Sarlavha */}
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && !form.contractId ? "var(--danger)" : "var(--text2)" }}>
                Shartnoma <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select className="form-input" value={form.contractId}
                onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
                style={Object.assign({ width: "100%", cursor: "pointer" }, submitted && !form.contractId ? { borderColor: "var(--danger)" } : {})}
              >
                <option value="">— Shartnomani tanlang —</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.contractNo}</option>
                ))}
              </select>
              {submitted && !form.contractId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Shartnoma tanlash shart</div>}

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && !form.title.trim() ? "var(--danger)" : "var(--text2)" }}>
                  Sarlavha <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input className="form-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Masalan: Metall konstruktsiya ishlab chiqarish"
                  style={submitted && !form.title.trim() ? { borderColor: "var(--danger)" } : undefined}
                />
                {submitted && !form.title.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Sarlavha kiritish shart</div>}
              </div>
            </div>

            {/* Izoh */}
            <div style={{ gridColumn: "1 / 2" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>Izoh</label>
              <textarea className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Qo'shimcha izoh (ixtiyoriy)" rows={6} style={{ resize: "none" }} />
            </div>

            <div style={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && !finalContractFile ? "var(--danger)" : "var(--text2)" }}>
                Shartnoma fayllari <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <label
                htmlFor="final-contract-file"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                  padding: "20px 16px", background: "var(--bg1)", transition: "border-color 0.15s", textAlign: "center",
                  minHeight: 130,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--danger)";
                  const icon = e.currentTarget.querySelector("svg");
                  const action = e.currentTarget.querySelector(".upload-action");
                  if (icon) icon.setAttribute("stroke", "var(--danger)");
                  if (action) (action as HTMLElement).style.color = "var(--danger)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  const icon = e.currentTarget.querySelector("svg");
                  const action = e.currentTarget.querySelector(".upload-action");
                  if (icon) icon.setAttribute("stroke", "var(--accent)");
                  if (action) (action as HTMLElement).style.color = "var(--accent)";
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="upload-action" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Asl shartnoma faylini tanlash</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                  {finalContractFile ? finalContractFile.name : "Fayl tanlanmagan"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Tayyor bo&apos;lgan asl shartnoma fayli</span>
                <input
                  id="final-contract-file"
                  type="file"
                  style={{ display: "none" }}
                  onChange={e => {
                    setFinalContractFile(e.target.files?.[0] ?? null);
                    setFileSubmitError("");
                  }}
                />
              </label>
            </div>

            <div style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && !templateContractFile ? "var(--danger)" : "var(--text2)" }}>
                Template fayli <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <label
                htmlFor="template-contract-file"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, cursor: "pointer", border: "2px dashed var(--border)", borderRadius: 10,
                  padding: "20px 16px", background: "var(--bg1)", transition: "border-color 0.15s", textAlign: "center",
                  minHeight: 130,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--danger)";
                  const icon = e.currentTarget.querySelector("svg");
                  const action = e.currentTarget.querySelector(".upload-action");
                  if (icon) icon.setAttribute("stroke", "var(--danger)");
                  if (action) (action as HTMLElement).style.color = "var(--danger)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  const icon = e.currentTarget.querySelector("svg");
                  const action = e.currentTarget.querySelector(".upload-action");
                  if (icon) icon.setAttribute("stroke", "var(--accent)");
                  if (action) (action as HTMLElement).style.color = "var(--accent)";
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="upload-action" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Template faylini tanlash</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                  {templateContractFile ? templateContractFile.name : "Fayl tanlanmagan"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Shartnomaning template varianti</span>
                <input
                  id="template-contract-file"
                  type="file"
                  style={{ display: "none" }}
                  onChange={e => {
                    setTemplateContractFile(e.target.files?.[0] ?? null);
                    setFileSubmitError("");
                  }}
                />
              </label>
              {fileSubmitError && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>
                  {fileSubmitError}
                </div>
              )}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? "Saqlanmoqda..." : "Qoralama saqlash"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: List ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>

      {/* ── Filter bar ── */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: sarlavha, shartnoma, klient..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select className="form-input" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 190, cursor: "pointer", height: 36, padding: "0 10px" }}>
          <option value="">Barcha statuslar</option>
          {Object.values(ProcessStatus).filter(v => typeof v === "number").map(v => (
            <option key={v} value={v}>{PROCESS_STATUS_LABELS[v as ProcessStatus]}</option>
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
          Yangi jarayon
        </button>
      </div>

      {/* ── Table ── */}
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
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Shartnoma</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sarlavha</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Status</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sana</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((tp, i) => (
                  <tr key={tp.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => openDrawer(tp)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                        {tp.contractNo}
                      </button>
                    </td>
                    <td style={{ fontWeight: 500 }}>{tp.title}</td>
                    <td style={{ textAlign: "center" }}><StatusBadge status={tp.status} /></td>
                    <td style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>{fmt(tp.createdAt)}</td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" onClick={() => openDrawer(tp)} title="Ko'rish"
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {tp.status === ProcessStatus.Pending && (
                          <button className="btn-icon" onClick={() => handleApproveRow(tp.id)} disabled={approvingId === tp.id} title="Tasdiqlash"
                            style={{ color: "var(--success)", borderColor: "var(--success)33", background: "var(--success-dim)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                        )}
                        <button className="btn-icon" onClick={() => openDrawerEdit(tp)} title="Tahrirlash"
                          style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={() => setDeleteId(tp.id)} title="O'chirish"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
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
      {drawer && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setDrawer(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 800, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
              padding: "28px 28px 32px", overflowY: "auto",
            }}
          >
            {/* Sticky header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "sticky", top: 0, background: "var(--bg2)", zIndex: 1, paddingBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>
                {drawerEditing ? "Texnologik jarayonni tahrirlash" : "Texnologik jarayon tafsilotlari"}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {drawerEditing ? (
                  <>
                    <button onClick={() => setDrawerEditing(false)}
                      style={{ padding: "6px 16px", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
                      Bekor
                    </button>
                    <button className="btn-primary" onClick={handleDrawerEditSave} disabled={drawerEditSaving}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", fontSize: 13, borderRadius: "var(--radius)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                      </svg>
                      {drawerEditSaving ? "Saqlanmoqda..." : "Saqlash"}
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setDrawerEditing(true); setDrawerEditForm({ title: drawer.title, notes: drawer.notes || "" }); }}
                    className="btn-icon" title="Tahrirlash"
                    style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setDrawer(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
              </div>
            </div>

            {/* Action buttons */}
            {!drawerEditing && (drawer.status === ProcessStatus.Pending || drawer.status === ProcessStatus.Approved || drawer.approvedByFullName) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
                {drawer.status === ProcessStatus.Pending && (
                  <button className="btn-primary" onClick={handleApprove} disabled={approving}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                    {approving ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                  </button>
                )}
                {drawer.status === ProcessStatus.Approved && (
                  <button onClick={handleSendToWarehouse} disabled={sendingWarehouse}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer", background: "var(--warn, #d97706)", color: "#fff" }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    {sendingWarehouse ? "Yuborilmoqda..." : "Omborga yuborish"}
                  </button>
                )}
                {drawer.approvedByFullName && (
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>
                    Tasdiqlagan: {drawer.approvedByFullName}{drawer.approvedAt && ` · ${fmt(drawer.approvedAt)}`}
                  </span>
                )}
              </div>
            )}

            {/* Info cards */}
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Shartnoma raqami</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{drawer.contractNo}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Status</div>
                <StatusBadge status={drawer.status} />
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratilgan sana</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{fmt(drawer.createdAt)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Sarlavha</div>
              {drawerEditing ? (
                <input className="form-input" value={drawerEditForm.title} onChange={e => setDrawerEditForm(f => ({ ...f, title: e.target.value }))} placeholder="Sarlavha" />
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>{drawer.title}</div>
              )}
            </div>

            {(drawerEditing || drawer.notes) && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
                {drawerEditing ? (
                  <input className="form-input" value={drawerEditForm.notes} onChange={e => setDrawerEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Izoh (ixtiyoriy)" />
                ) : (
                  <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap" }}>{drawer.notes}</div>
                )}
              </div>
            )}

          </div>
        </div>
      )}


      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--bg1)", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>Jarayonni o&apos;chirish</div>
            <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              Bu texnologik jarayon o&apos;chiriladi. Barcha qadamlar va materiallar ham o&apos;chiriladi. Amalni ortga qaytarib bo&apos;lmaydi.
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
