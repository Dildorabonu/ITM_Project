"use client";

import { useEffect, useState } from "react";
import {
  contractService,
  departmentService,
  ContractStatus,
  Priority,
  CONTRACT_STATUS_LABELS,
  PRIORITY_LABELS,
  type ContractResponse,
  type ContractCreatePayload,
  type ContractUpdatePayload,
  type DepartmentOption,
} from "@/lib/userService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractForm {
  contractNo: string;
  clientName: string;
  productType: string;
  quantity: string;
  unit: string;
  startDate: string;
  endDate: string;
  departmentId: string;
  priority: string;
  notes: string;
}

const emptyForm: ContractForm = {
  contractNo: "", clientName: "", productType: "",
  quantity: "", unit: "", startDate: "", endDate: "",
  departmentId: "", priority: String(Priority.Medium), notes: "",
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
      borderRadius: 20, fontSize: 12, fontWeight: 600,
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
  const [departments, setDepartments]   = useState<DepartmentOption[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  // Filters
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept]     = useState("");

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
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      contracts.filter(c => {
        const matchSearch = !q ||
          c.contractNo.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          c.productType.toLowerCase().includes(q);
        const matchStatus = filterStatus === "" || c.status === Number(filterStatus);
        const matchDept   = !filterDept   || c.departmentId === filterDept;
        return matchSearch && matchStatus && matchDept;
      })
    );
  }, [search, filterStatus, filterDept, contracts]);

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
      clientName:   c.clientName,
      productType:  c.productType,
      quantity:     String(c.quantity),
      unit:         c.unit,
      startDate:    c.startDate.slice(0, 10),
      endDate:      c.endDate.slice(0, 10),
      departmentId: c.departmentId,
      priority:     String(c.priority),
      notes:        c.notes ?? "",
    });
    setSubmitted(false);
    setFormError("");
    setShowForm(true);
  };

  const isValid = () =>
    form.contractNo.trim() && form.clientName.trim() &&
    form.productType.trim() && form.quantity && form.unit.trim() &&
    form.startDate && form.endDate && form.departmentId;

  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid()) return;
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        const dto: ContractUpdatePayload = {
          contractNo:   form.contractNo,
          clientName:   form.clientName,
          productType:  form.productType,
          quantity:     Number(form.quantity),
          unit:         form.unit,
          startDate:    form.startDate,
          endDate:      form.endDate,
          departmentId: form.departmentId,
          priority:     Number(form.priority) as Priority,
          notes:        form.notes || null,
        };
        await contractService.update(editTarget.id, dto);
      } else {
        const dto: ContractCreatePayload = {
          contractNo:   form.contractNo,
          clientName:   form.clientName,
          productType:  form.productType,
          quantity:     Number(form.quantity),
          unit:         form.unit,
          startDate:    form.startDate,
          endDate:      form.endDate,
          departmentId: form.departmentId,
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

            {/* Mijoz nomi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.clientName) ? "var(--danger)" : "var(--text2)" }}>
                Mijoz nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.clientName}
                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Mijoz nomi"
                style={fieldErr(form.clientName) ? { borderColor: "var(--danger)" } : undefined}
              />
              {fieldErr(form.clientName) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Mijoz nomini kiriting</div>}
            </div>

            {/* Mahsulot turi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.productType) ? "var(--danger)" : "var(--text2)" }}>
                Mahsulot turi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.productType}
                onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}
                placeholder="Masalan: Metall Konstruktsiya"
                style={fieldErr(form.productType) ? { borderColor: "var(--danger)" } : undefined}
              />
              {fieldErr(form.productType) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Mahsulot turini kiriting</div>}
            </div>

            {/* Bo'lim */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: submitted && !form.departmentId ? "var(--danger)" : "var(--text2)" }}>
                Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select className="form-input" value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                style={{ width: "100%", cursor: "pointer", ...(submitted && !form.departmentId ? { borderColor: "var(--danger)" } : {}) }}>
                <option value="">— Bo&apos;lim tanlang —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {submitted && !form.departmentId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Bo&apos;limni tanlang</div>}
            </div>

            {/* Miqdor */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: submitted && !form.quantity ? "var(--danger)" : "var(--text2)" }}>
                Miqdor <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                style={submitted && !form.quantity ? { borderColor: "var(--danger)" } : undefined}
              />
              {submitted && !form.quantity && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Miqdorni kiriting</div>}
            </div>

            {/* O'lchov birligi */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: fieldErr(form.unit) ? "var(--danger)" : "var(--text2)" }}>
                O&apos;lchov birligi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="Dona, kg, metr..."
                style={fieldErr(form.unit) ? { borderColor: "var(--danger)" } : undefined}
              />
              {fieldErr(form.unit) && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>O&apos;lchov birligini kiriting</div>}
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
          <input className="search-input" placeholder="Qidirish (raqam, mijoz, mahsulot)"
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

        <select className="form-input" value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ width: 170, cursor: "pointer", height: 36, padding: "0 10px", background: "#fff" }}>
          <option value="">Barcha bo&apos;limlar</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                  <th style={{ width: 40, paddingLeft: 8, borderRight: "2px solid var(--border)", color: "var(--text1)" }}>#</th>
                  <th style={{ color: "var(--text1)" }}>Raqam</th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Mijoz</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Mahsulot</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Miqdor</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Bo&apos;lim</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Muddat</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Muhimlik</span></th>
                  <th style={{ color: "var(--text1)" }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>Holat</span></th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: 8, borderRight: "2px solid var(--border)", color: "var(--text2)", fontSize: 13 }}>{i + 1}</td>
                    <td>
                      <button onClick={() => setViewContract(c)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                        {c.contractNo}
                      </button>
                    </td>
                    <td style={{ paddingLeft: 8 }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>{c.clientName}</span></td>
                    <td style={{ paddingLeft: 8 }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>{c.productType}</span></td>
                    <td style={{ paddingLeft: 8 }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>{c.quantity} {c.unit}</span></td>
                    <td style={{ paddingLeft: 8 }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>{c.departmentName ?? "—"}</span></td>
                    <td style={{ paddingLeft: 8 }}>
                      <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8, fontSize: 12, color: "var(--text2)" }}>
                        {fmt(c.startDate)} – {fmt(c.endDate)}
                      </span>
                    </td>
                    <td style={{ paddingLeft: 8 }}><span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}><PriorityBadge priority={c.priority} /></span></td>
                    <td style={{ paddingLeft: 8 }}>
                      <span style={{ borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>
                        <button onClick={() => { setStatusTarget(c); setNewStatus(String(c.status)); }}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          <StatusBadge status={c.status} />
                        </button>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "center", gap: 6, borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>
                        <button onClick={() => openEdit(c)} title="Tahrirlash"
                          style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)44", borderRadius: 6, cursor: "pointer", padding: "5px 8px", color: "var(--accent)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteId(c.id)} title="O'chirish"
                          style={{ background: "var(--danger-dim)", border: "1px solid var(--danger)44", borderRadius: 6, cursor: "pointer", padding: "5px 8px", color: "var(--danger)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
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
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div onClick={() => setViewContract(null)}
            style={{ flex: 1, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ width: 420, background: "var(--bg1)", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{viewContract.contractNo}</span>
              <button onClick={() => setViewContract(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", padding: 4 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {[
              ["Mijoz",           viewContract.clientName],
              ["Mahsulot turi",   viewContract.productType],
              ["Miqdor",          `${viewContract.quantity} ${viewContract.unit}`],
              ["Bo'lim",          viewContract.departmentName ?? "—"],
              ["Boshlanish",      fmt(viewContract.startDate)],
              ["Tugash",          fmt(viewContract.endDate)],
              ["Yaratuvchi",      viewContract.createdByFullName ?? "—"],
              ["Yaratilgan",      fmt(viewContract.createdAt)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{val}</span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text2)" }}>Muhimlik</span>
              <PriorityBadge priority={viewContract.priority} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text2)" }}>Holat</span>
              <StatusBadge status={viewContract.status} />
            </div>

            {viewContract.notes && (
              <div style={{ padding: "12px 14px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                {viewContract.notes}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
              <button onClick={() => { setViewContract(null); openEdit(viewContract); }}
                style={{ flex: 1, padding: "10px 0", background: "var(--accent-dim)", border: "1px solid var(--accent)44", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
                Tahrirlash
              </button>
              <button onClick={() => { setViewContract(null); setDeleteId(viewContract.id); }}
                style={{ flex: 1, padding: "10px 0", background: "var(--danger-dim)", border: "1px solid var(--danger)44", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--danger)", fontWeight: 600, fontSize: 13 }}>
                O&apos;chirish
              </button>
            </div>
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
