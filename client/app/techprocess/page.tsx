"use client";

import { useEffect, useState } from "react";
import {
  techProcessService,
  contractService,
  materialService,
  ProcessStatus,
  PROCESS_STATUS_LABELS,
  type TechProcessResponse,
  type TechProcessCreatePayload,
  type TechStepCreatePayload,
  type TechProcessMaterialCreatePayload,
  type ContractResponse,
  type MaterialOption,
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
  return d ? d.slice(0, 10).split("-").reverse().join(".") : "—";
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
  const [drawerTab, setDrawerTab] = useState<"steps" | "materials">("steps");
  const [drawerLoading, setDrawerLoading] = useState(false);

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

  // Add step modal
  const [showStepModal, setShowStepModal]   = useState(false);
  const [stepForm, setStepForm]             = useState({ stepNumber: "", name: "", responsibleDept: "", machine: "", timeNorm: "", notes: "" });
  const [stepSubmitted, setStepSubmitted]   = useState(false);
  const [savingStep, setSavingStep]         = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  // Add material modal
  const [showMatModal, setShowMatModal]       = useState(false);
  const [materials, setMaterials]             = useState<MaterialOption[]>([]);
  const [matForm, setMatForm]                 = useState({ materialId: "", requiredQty: "" });
  const [matSubmitted, setMatSubmitted]       = useState(false);
  const [savingMat, setSavingMat]             = useState(false);
  const [deletingMatId, setDeletingMatId]     = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // Action buttons
  const [approving, setApproving]             = useState(false);
  const [sendingWarehouse, setSendingWarehouse] = useState(false);

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
          t.contractNo.toLowerCase().includes(q) ||
          t.clientName.toLowerCase().includes(q);
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
    setDrawerTab("steps");
    setDrawerLoading(true);
    try {
      const fresh = await techProcessService.getById(tp.id);
      setDrawer(fresh);
    } finally {
      setDrawerLoading(false);
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

  // ── Steps ───────────────────────────────────────────────────────────────────

  const openStepModal = () => {
    setStepForm({ stepNumber: String((drawer?.steps.length ?? 0) + 1), name: "", responsibleDept: "", machine: "", timeNorm: "", notes: "" });
    setStepSubmitted(false);
    setShowStepModal(true);
  };

  const handleAddStep = async () => {
    setStepSubmitted(true);
    if (!stepForm.name.trim() || !stepForm.responsibleDept.trim() || !stepForm.stepNumber) return;
    if (!drawer) return;
    setSavingStep(true);
    try {
      const dto: TechStepCreatePayload = {
        stepNumber: Number(stepForm.stepNumber),
        name: stepForm.name.trim(),
        responsibleDept: stepForm.responsibleDept.trim(),
        machine: stepForm.machine || null,
        timeNorm: stepForm.timeNorm || null,
        notes: stepForm.notes || null,
      };
      await techProcessService.addStep(drawer.id, dto);
      await refreshDrawer(drawer.id);
      setShowStepModal(false);
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!drawer) return;
    setDeletingStepId(stepId);
    try {
      await techProcessService.deleteStep(drawer.id, stepId);
      await refreshDrawer(drawer.id);
    } finally {
      setDeletingStepId(null);
    }
  };

  // ── Materials ────────────────────────────────────────────────────────────────

  const openMatModal = async () => {
    setMatForm({ materialId: "", requiredQty: "" });
    setMatSubmitted(false);
    setShowMatModal(true);
    if (materials.length === 0) {
      const data = await materialService.getAll();
      setMaterials(data);
    }
  };

  const handleAddMaterial = async () => {
    setMatSubmitted(true);
    if (!matForm.materialId || !matForm.requiredQty || Number(matForm.requiredQty) <= 0) return;
    if (!drawer) return;
    setSavingMat(true);
    try {
      const dto: TechProcessMaterialCreatePayload = {
        materialId: matForm.materialId,
        requiredQty: Number(matForm.requiredQty),
      };
      await techProcessService.addMaterial(drawer.id, dto);
      await refreshDrawer(drawer.id);
      setShowMatModal(false);
    } finally {
      setSavingMat(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!drawer) return;
    setDeletingMatId(materialId);
    try {
      await techProcessService.deleteMaterial(drawer.id, materialId);
      await refreshDrawer(drawer.id);
    } finally {
      setDeletingMatId(null);
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
                  <option key={c.id} value={c.id}>{c.contractNo} — {c.clientName}</option>
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
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
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
                  <th style={{ color: "var(--text1)" }}>Sarlavha</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Qadamlar</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Materiallar</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Status</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sana</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((tp, i) => (
                  <tr key={tp.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => openDrawer(tp)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                        {tp.contractNo}
                      </button>
                      {tp.clientName && (
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{tp.clientName}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{tp.title}</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 20, padding: "2px 10px", fontWeight: 600, fontSize: 12 }}>
                        {tp.steps.length}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ background: "var(--warn-dim)", color: "var(--warn)", borderRadius: 20, padding: "2px 10px", fontWeight: 600, fontSize: 12 }}>
                        {tp.materials.length}
                      </span>
                    </td>
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
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Texnologik jarayon tafsilotlari</span>
              <button onClick={() => setDrawer(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* Action buttons */}
            {(drawer.status === ProcessStatus.Pending || drawer.status === ProcessStatus.Approved || drawer.approvedByFullName) && (
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
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Mijoz</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)" }}>{drawer.clientName || "—"}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Qadamlar soni</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>{drawer.steps.length}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Materiallar soni</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--warn, #d97706)" }}>{drawer.materials.length}</div>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Sarlavha</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>{drawer.title}</div>
            </div>

            {drawer.notes && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 6 }}>Izoh</div>
                <div style={{ fontSize: 14, color: "var(--text1)", whiteSpace: "pre-wrap" }}>{drawer.notes}</div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 20, marginTop: 4 }}>
              <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)", marginBottom: 16 }}>
                {(["steps", "materials"] as const).map(tab => (
                  <button key={tab} onClick={() => setDrawerTab(tab)}
                    style={{
                      padding: "10px 20px", fontSize: 13, fontWeight: 600, border: "none", background: "none",
                      cursor: "pointer", borderBottom: drawerTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                      color: drawerTab === tab ? "var(--accent)" : "var(--text2)",
                    }}>
                    {tab === "steps" ? `Qadamlar (${drawer.steps.length})` : `Materiallar (${drawer.materials.length})`}
                  </button>
                ))}
              </div>

              {drawerLoading ? (
                <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "16px 0" }}>Yuklanmoqda...</div>
              ) : drawerTab === "steps" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button onClick={openStepModal}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", cursor: "pointer", background: "var(--bg1)", color: "var(--text2)" }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Qadam qo&apos;shish
                    </button>
                  </div>
                  {drawer.steps.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "32px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                      Qadamlar yo&apos;q. Yangi qadam qo&apos;shing.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {drawer.steps.map(step => (
                        <div key={step.id} style={{
                          display: "flex", gap: 12, alignItems: "flex-start",
                          border: "1.5px solid var(--border)", borderRadius: 8,
                          padding: "10px 12px", background: "var(--bg2)",
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", background: "var(--accent-dim)",
                            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: 13, flexShrink: 0,
                          }}>
                            {step.stepNumber}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{step.name}</div>
                            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                              Bo&apos;lim: {step.responsibleDept}
                              {step.machine && ` · Mashina: ${step.machine}`}
                              {step.timeNorm && ` · Vaqt: ${step.timeNorm}`}
                            </div>
                            {step.notes && (
                              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{step.notes}</div>
                            )}
                          </div>
                          <button onClick={() => handleDeleteStep(step.id)} disabled={deletingStepId === step.id} title="O'chirish"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button onClick={openMatModal}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", cursor: "pointer", background: "var(--bg1)", color: "var(--text2)" }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Material qo&apos;shish
                    </button>
                  </div>
                  {drawer.materials.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "32px 0", border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                      Materiallar yo&apos;q. Yangi material qo&apos;shing.
                    </div>
                  ) : (
                    <table className="itm-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Birlik</th>
                          <th style={{ textAlign: "right" }}>Kerakli</th>
                          <th style={{ textAlign: "right" }}>Mavjud</th>
                          <th>Holat</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {drawer.materials.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600, color: "var(--text1)" }}>{m.materialName}</td>
                            <td style={{ fontSize: 13, color: "var(--text3)" }}>{m.unit}</td>
                            <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{m.requiredQty}</td>
                            <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "var(--font-mono)", color: m.availableQty >= m.requiredQty ? "var(--success)" : "var(--danger)" }}>
                              {m.availableQty}
                            </td>
                            <td><span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>{m.status}</span></td>
                            <td>
                              <button onClick={() => handleDeleteMaterial(m.materialId)} disabled={deletingMatId === m.materialId} title="O'chirish"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Step Modal ── */}
      {showStepModal && (
        <div className="modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
            <div className="modal-header">
              <span className="modal-title">Qadam qo&apos;shish</span>
              <button className="icon-btn" onClick={() => setShowStepModal(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tartib raqami <span style={{ color: "var(--danger)" }}>*</span></label>
                  <input type="number"
                    className={`form-input${stepSubmitted && !stepForm.stepNumber ? " input-error" : ""}`}
                    min={1} value={stepForm.stepNumber}
                    onChange={e => setStepForm(f => ({ ...f, stepNumber: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mas&apos;ul bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span></label>
                  <input
                    className={`form-input${stepSubmitted && !stepForm.responsibleDept.trim() ? " input-error" : ""}`}
                    placeholder="Bo'lim nomi" value={stepForm.responsibleDept}
                    onChange={e => setStepForm(f => ({ ...f, responsibleDept: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nomi <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className={`form-input${stepSubmitted && !stepForm.name.trim() ? " input-error" : ""}`}
                  placeholder="Qadam nomi" value={stepForm.name}
                  onChange={e => setStepForm(f => ({ ...f, name: e.target.value }))} />
                {stepSubmitted && !stepForm.name.trim() && <div className="field-error">Nomi kiritish shart</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Mashina/Uskuna</label>
                  <input className="form-input" placeholder="Ixtiyoriy" value={stepForm.machine}
                    onChange={e => setStepForm(f => ({ ...f, machine: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vaqt normasi</label>
                  <input className="form-input" placeholder="Masalan: 4 soat" value={stepForm.timeNorm}
                    onChange={e => setStepForm(f => ({ ...f, timeNorm: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Izoh</label>
                <textarea className="form-input" rows={2} placeholder="Qo'shimcha izoh..."
                  value={stepForm.notes} onChange={e => setStepForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ resize: "vertical" }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowStepModal(false)}>Bekor qilish</button>
              <button className="btn btn-primary" onClick={handleAddStep} disabled={savingStep}>
                {savingStep ? "Qo'shilmoqda..." : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Material Modal ── */}
      {showMatModal && (
        <div className="modal-overlay" onClick={() => setShowMatModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Material qo&apos;shish</span>
              <button className="icon-btn" onClick={() => setShowMatModal(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Material <span style={{ color: "var(--danger)" }}>*</span></label>
                <select
                  className={`form-input${matSubmitted && !matForm.materialId ? " input-error" : ""}`}
                  value={matForm.materialId}
                  onChange={e => setMatForm(f => ({ ...f, materialId: e.target.value }))}
                >
                  <option value="">— Materialni tanlang —</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.unit}) — mavjud: {m.quantity}</option>
                  ))}
                </select>
                {matSubmitted && !matForm.materialId && <div className="field-error">Material tanlash shart</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Kerakli miqdor <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="number"
                  className={`form-input${matSubmitted && (!matForm.requiredQty || Number(matForm.requiredQty) <= 0) ? " input-error" : ""}`}
                  min={0.01} step={0.01} placeholder="0.00" value={matForm.requiredQty}
                  onChange={e => setMatForm(f => ({ ...f, requiredQty: e.target.value }))} />
                {matSubmitted && (!matForm.requiredQty || Number(matForm.requiredQty) <= 0) && (
                  <div className="field-error">Miqdor 0 dan katta bo&apos;lishi shart</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowMatModal(false)}>Bekor qilish</button>
              <button className="btn btn-primary" onClick={handleAddMaterial} disabled={savingMat}>
                {savingMat ? "Qo'shilmoqda..." : "Qo'shish"}
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
