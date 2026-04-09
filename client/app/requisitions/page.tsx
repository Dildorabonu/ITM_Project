"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  materialService,
  contractService,
  departmentService,
  RequisitionType,
  RequisitionStatus,
  type RequisitionResponse,
  type MaterialResponse,
  type ContractResponse,
  type DepartmentResponse,
} from "@/lib/userService";
import {
  emptyForm,
  fmtDate,
  REQUISITION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
  type RequisitionForm,
  type RequisitionFormItem,
} from "./_types";
import { RequisitionStatusBadge } from "./_components/StatusBadge";
import { RequisitionDrawer } from "./_components/RequisitionDrawer";

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
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);
  const searchParams = useSearchParams();

  const canCreate = hasPermission("Requisitions.Create");

  // ── List ───────────────────────────────────────────────────────────────────
  const [list, setList] = useState<RequisitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<RequisitionResponse | null>(null);
  const [acting, setActing] = useState(false);

  // ── Reject modal ──────────────────────────────────────────────────────────
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  // ── Create form ───────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RequisitionForm>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Reference data
  const [materials, setMaterials] = useState<MaterialResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [matPickerIdx, setMatPickerIdx] = useState<number | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const data = await requisitionService.getAll();
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open form if redirected from tasks page with contractId
  useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (contractId) {
      setForm({ ...emptyForm, type: RequisitionType.Contract, contractId });
      setShowForm(true);
      setSubmitted(false);
      setFormError("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showForm) {
      materialService.getAll().then(setMaterials);
      contractService.getAll().then(setContracts);
      departmentService.getAllFull().then(setDepartments);
    }
  }, [showForm]);

  // ── Filter ─────────────────────────────────────────────────────────────────
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

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSubmit = async (id: string) => {
    setActing(true);
    try {
      await requisitionService.submit(id);
      showToast("Talabnoma direktorga yuborildi", "success");
      await load();
      setSelected(prev => prev?.id === id ? { ...prev, status: RequisitionStatus.Pending } : prev);
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleApprove = async (id: string) => {
    setActing(true);
    try {
      await requisitionService.approve(id);
      showToast("Talabnoma tasdiqlandi", "success");
      await load();
      // Refresh selected with new QR
      const updated = await requisitionService.getById(id);
      if (updated) setSelected(updated);
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  const handleRejectOpen = (id: string) => {
    setRejectId(id);
    setRejectReason("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await requisitionService.reject(rejectId, rejectReason.trim());
      showToast("Talabnoma rad etildi", "success");
      setRejectId(null);
      setSelected(null);
      await load();
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setRejectSaving(false); }
  };

  const handleSendToWarehouse = async (id: string) => {
    setActing(true);
    try {
      await requisitionService.sendToWarehouse(id);
      showToast("Omborga yuborildi", "success");
      await load();
      setSelected(prev => prev?.id === id ? { ...prev, status: RequisitionStatus.SentToWarehouse } : prev);
    } catch {
      showToast("Xatolik yuz berdi", "error");
    } finally { setActing(false); }
  };

  // ── Form create ────────────────────────────────────────────────────────────
  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { materialId: "", materialName: "", materialCode: "", unit: "", quantity: "", notes: "" }] }));
  };

  const removeItem = (i: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  };

  const updateItem = (i: number, patch: Partial<RequisitionFormItem>) => {
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));
  };

  const selectMaterial = (i: number, mat: MaterialResponse) => {
    updateItem(i, { materialId: mat.id, materialName: mat.name, materialCode: mat.code, unit: mat.unit });
    setMatPickerIdx(null);
    setMatSearch("");
  };

  const handleCreate = async () => {
    setSubmitted(true);
    setFormError("");

    if (!form.type && form.type !== 0) return;
    if (form.type === RequisitionType.Contract && !form.contractId) return;
    if (form.type === RequisitionType.Individual && !form.departmentId) return;
    if (!form.purpose.trim()) return;
    if (form.items.length === 0) { setFormError("Kamida bitta material qo'shing."); return; }
    if (form.items.some(i => !i.materialId || !i.quantity || Number(i.quantity) <= 0)) {
      setFormError("Barcha materiallar to'ldirilishi shart.");
      return;
    }

    setSaving(true);
    try {
      await requisitionService.create({
        type: form.type as RequisitionType,
        contractId: form.contractId || undefined,
        departmentId: form.departmentId || undefined,
        purpose: form.purpose,
        notes: form.notes || undefined,
        items: form.items.map(i => ({ materialId: i.materialId, quantity: Number(i.quantity), notes: i.notes || undefined })),
      });
      showToast("Talabnoma yaratildi", "success");
      setShowForm(false);
      setForm(emptyForm);
      setSubmitted(false);
      await load();
    } catch {
      setFormError("Xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally { setSaving(false); }
  };

  // ─── filtered materials for picker ────────────────────────────────────────
  const filteredMats = useMemo(() => {
    if (!matSearch.trim()) return materials.slice(0, 30);
    const q = matSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)).slice(0, 30);
  }, [materials, matSearch]);

  // ─── Render ────────────────────────────────────────────────────────────────
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
        {canCreate && (
          <button
            className="btn-primary"
            onClick={() => { setShowForm(true); setForm(emptyForm); setSubmitted(false); setFormError(""); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yangi talabnoma
          </button>
        )}
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
                  onClick={() => setSelected(r)}
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

      {/* Drawer */}
      {selected && (
        <RequisitionDrawer
          req={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleRejectOpen}
          onSubmit={handleSubmit}
          onSendToWarehouse={handleSendToWarehouse}
          acting={acting}
        />
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setRejectId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "var(--shadow2)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--text1)" }}>Rad etish sababi</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Sababni kiriting…"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--bg3)", color: "var(--text1)" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setRejectId(null)} style={{ flex: 1, padding: "9px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}>Bekor</button>
              <button
                disabled={!rejectReason.trim() || rejectSaving}
                onClick={handleRejectConfirm}
                style={{ flex: 1, padding: "9px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: !rejectReason.trim() || rejectSaving ? "not-allowed" : "pointer", fontWeight: 600, opacity: !rejectReason.trim() || rejectSaving ? 0.7 : 1 }}
              >{rejectSaving ? "…" : "Rad etish"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 2000, overflowY: "auto", padding: "32px 16px" }}
          onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: 14, padding: 28, width: 700, maxWidth: "100%", boxShadow: "var(--shadow2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Yangi talabnoma</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18 }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type */}
              <div>
                <label style={lbl}>Turi *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([RequisitionType.Contract, RequisitionType.Individual] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t, contractId: "", departmentId: "" }))}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        border: form.type === t ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                        background: form.type === t ? "var(--accent-dim)" : "var(--bg3)",
                        color: form.type === t ? "var(--accent)" : "var(--text2)",
                      }}
                    >{REQUISITION_TYPE_LABELS[t]}</button>
                  ))}
                </div>
                {submitted && form.type === "" && <div style={errStyle}>Tur tanlanishi shart</div>}
              </div>

              {/* Contract */}
              {form.type === RequisitionType.Contract && (
                <div>
                  <label style={lbl}>Shartnoma *</label>
                  <select value={form.contractId} onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))} style={sel}>
                    <option value="">— Tanlang —</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNo} — {c.contractParty}</option>)}
                  </select>
                  {submitted && form.type === RequisitionType.Contract && !form.contractId && <div style={errStyle}>Shartnoma tanlanishi shart</div>}
                </div>
              )}

              {/* Department */}
              {form.type === RequisitionType.Individual && (
                <div>
                  <label style={lbl}>Bo'lim *</label>
                  <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} style={sel}>
                    <option value="">— Tanlang —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {submitted && form.type === RequisitionType.Individual && !form.departmentId && <div style={errStyle}>Bo'lim tanlanishi shart</div>}
                </div>
              )}

              {/* Purpose */}
              <div>
                <label style={lbl}>Maqsad *</label>
                <textarea
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  rows={2}
                  placeholder="Talabnoma maqsadi…"
                  style={{ ...inp, resize: "vertical" }}
                />
                {submitted && !form.purpose.trim() && <div style={errStyle}>Maqsad kiritilishi shart</div>}
              </div>

              {/* Notes */}
              <div>
                <label style={lbl}>Izoh</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Qo'shimcha izoh (ixtiyoriy)…"
                  style={{ ...inp, resize: "vertical" }}
                />
              </div>

              {/* Materials */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Materiallar *</label>
                  <button onClick={addItem} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>+ Qo'shish</button>
                </div>

                {form.items.length === 0 ? (
                  <div style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--radius)", padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                    Material qo'shilmagan
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {form.items.map((item, i) => (
                      <div key={i} style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, position: "relative" }}>
                        <button onClick={() => removeItem(i)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14 }}>✕</button>

                        {/* Material picker */}
                        <div style={{ marginBottom: 8, position: "relative" }}>
                          <label style={lbl}>Material *</label>
                          <input
                            readOnly
                            value={item.materialName || ""}
                            onClick={() => setMatPickerIdx(matPickerIdx === i ? null : i)}
                            placeholder="Material tanlang…"
                            style={{ ...inp, cursor: "pointer", background: item.materialName ? "var(--bg3)" : "var(--bg2)" }}
                          />
                          {matPickerIdx === i && (
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow2)", maxHeight: 220, overflowY: "auto" }}>
                              <div style={{ padding: "8px" }}>
                                <input
                                  autoFocus
                                  value={matSearch}
                                  onChange={e => setMatSearch(e.target.value)}
                                  placeholder="Qidirish…"
                                  style={{ ...inp, marginBottom: 0 }}
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
                              {filteredMats.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => selectMaterial(i, m)}
                                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderTop: "1px solid var(--border)" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                                >
                                  <span style={{ fontWeight: 600, color: "var(--text1)" }}>{m.name}</span>
                                  <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: 8 }}>{m.code} · {m.unit}</span>
                                </div>
                              ))}
                              {filteredMats.length === 0 && <div style={{ padding: "12px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Topilmadi</div>}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label style={lbl}>Miqdor *</label>
                            <input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={e => updateItem(i, { quantity: e.target.value })}
                              placeholder="0"
                              style={inp}
                            />
                          </div>
                          <div>
                            <label style={lbl}>O'lchov</label>
                            <input readOnly value={item.unit} style={{ ...inp, background: "var(--bg3)", color: "var(--text3)" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formError && <div style={{ ...errStyle, marginTop: 8 }}>{formError}</div>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}>Bekor</button>
              <button
                disabled={saving}
                onClick={handleCreate}
                style={{ flex: 2, padding: "10px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
              >{saving ? "Saqlanmoqda…" : "Yaratish"}</button>
            </div>
          </div>
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

// ─── Shared styles ─────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 5 };
const errStyle: React.CSSProperties = { fontSize: 11, color: "var(--danger)", marginTop: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text1)", boxSizing: "border-box" };
const sel: React.CSSProperties = { ...inp, cursor: "pointer" };
