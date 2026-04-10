"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  materialService,
  contractService,
  departmentService,
  costNormService,
  DrawingStatus,
  RequisitionType,
  type MaterialResponse,
  type ContractResponse,
  type DepartmentResponse,
} from "@/lib/userService";
import {
  emptyForm,
  REQUISITION_TYPE_LABELS,
  type RequisitionForm,
  type RequisitionFormItem,
} from "../_types";
import { CheckSelect } from "../_components/CheckSelect";

function NewRequisitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const showToast = useToastStore((s) => s.show);

  const canCreate = hasPermission("Requisitions.Create");

  const [form, setForm] = useState<RequisitionForm>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [materials, setMaterials] = useState<MaterialResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [matPickerIdx, setMatPickerIdx] = useState<number | null>(null);
  const [normLoading, setNormLoading] = useState(false);
  const [normMsg, setNormMsg] = useState<{ type: "ok" | "warn" | "none"; text: string } | null>(null);

  useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (contractId) {
      setForm({ ...emptyForm, type: RequisitionType.Contract, contractId });
    }
    materialService.getAll().then(setMaterials);
    contractService.getAll().then(setContracts);
    departmentService.getAllFull().then(setDepartments);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillFromNorm = async () => {
    if (!form.contractId) return;
    setNormLoading(true);
    setNormMsg(null);
    try {
      const norms = await costNormService.getAll(form.contractId);
      const norm =
        norms.find(n => n.isActive && n.status === DrawingStatus.Approved) ??
        norms.find(n => n.isActive) ??
        norms[0];

      if (!norm) {
        setNormMsg({ type: "warn", text: "Bu shartnoma uchun me'yoriy sarf topilmadi." });
        return;
      }

      const qty = norm.contractQuantity;
      const lines = norm.items.filter(i => !i.isSection && i.totalQty);
      if (lines.length === 0) {
        setNormMsg({ type: "warn", text: "Me'yoriy sarfda material qatorlari topilmadi." });
        return;
      }

      const newItems = lines.map(ni => {
        const total = parseFloat((ni.totalQty ?? "0").replace(",", ".")) * qty;
        const mat = materials.find(m =>
          (ni.no  && m.code.toLowerCase() === ni.no.trim().toLowerCase()) ||
          (ni.name && m.name.toLowerCase() === ni.name.trim().toLowerCase())
        );
        return {
          materialId:   mat?.id   ?? "",
          materialName: mat?.name ?? ni.name ?? "",
          materialCode: mat?.code ?? ni.no   ?? "",
          unit:         mat?.unit ?? ni.unit ?? "",
          quantity:     total > 0 ? String(total) : "",
          notes:        "",
        };
      });

      setForm(f => ({ ...f, items: newItems }));
      setNormMsg({ type: "ok", text: `Me'yoriy sarfdan ${newItems.length} ta material to'ldirildi` });
    } catch {
      setNormMsg({ type: "warn", text: "Me'yoriy sarf yuklanmadi." });
    } finally {
      setNormLoading(false);
    }
  };

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

  const filteredMats = useMemo(() => {
    if (!matSearch.trim()) return materials.slice(0, 30);
    const q = matSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)).slice(0, 30);
  }, [materials, matSearch]);

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
      router.push("/requisitions");
    } catch {
      setFormError("Xatolik yuz berdi. Qayta urinib ko'ring.");
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text3)" }}>
        Ruxsat yo'q
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/requisitions")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Orqaga
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text1)" }}>Yangi talabnoma</h1>
      </div>

      <div className="itm-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Type */}
          <div>
            <label style={lbl}>Turi *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {([RequisitionType.Contract, RequisitionType.Individual] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setNormMsg(null); setForm(f => ({ ...f, type: t, contractId: "", departmentId: "", items: [] })); }}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, cursor: "pointer",
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
              <CheckSelect
                value={form.contractId}
                onChange={v => { setNormMsg(null); setForm(f => ({ ...f, contractId: v, items: [] })); }}
                options={contracts.map(c => ({ id: c.id, name: c.contractParty ? `${c.contractNo} — ${c.contractParty}` : c.contractNo }))}
                placeholder="— Tanlang —"
              />
              {submitted && form.type === RequisitionType.Contract && !form.contractId && <div style={errStyle}>Shartnoma tanlanishi shart</div>}
            </div>
          )}

          {/* Department */}
          {form.type === RequisitionType.Individual && (
            <div>
              <label style={lbl}>Bo'lim *</label>
              <CheckSelect
                value={form.departmentId}
                onChange={v => setForm(f => ({ ...f, departmentId: v }))}
                options={departments.map(d => ({ id: d.id, name: d.name }))}
                placeholder="— Tanlang —"
              />
              {submitted && form.type === RequisitionType.Individual && !form.departmentId && <div style={errStyle}>Bo'lim tanlanishi shart</div>}
            </div>
          )}

          {/* Purpose */}
          <div>
            <label style={lbl}>Maqsad *</label>
            <textarea
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={3}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Materiallar *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {form.type === RequisitionType.Contract && (
                  <button
                    type="button"
                    disabled={!form.contractId || normLoading}
                    onClick={fillFromNorm}
                    style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--radius)", border: "2px solid #2563eb", background: "#2563eb", color: "#fff", cursor: (!form.contractId || normLoading) ? "not-allowed" : "pointer", opacity: (!form.contractId || normLoading) ? 0.45 : 1 }}
                  >
                    {normLoading ? "Yuklanmoqda…" : "Me'yoriy sarfdan to'ldirish"}
                  </button>
                )}
                <button onClick={addItem} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>+ Qo'shish</button>
              </div>
            </div>

            {normMsg && !normLoading && (
              <div style={{
                marginBottom: 10, padding: "9px 13px", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600,
                background: normMsg.type === "ok" ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${normMsg.type === "ok" ? "#86efac" : "#fcd34d"}`,
                color: normMsg.type === "ok" ? "#15803d" : "#92400e",
              }}>
                {normMsg.type === "ok" ? "✓ " : "⚠ "}{normMsg.text}
              </div>
            )}

            {form.items.length === 0 ? (
              <div style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--radius)", padding: "28px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                Material qo'shilmagan
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {form.items.map((item, i) => (
                  <div key={i} style={{ border: `1.5px solid ${item.materialName && !item.materialId ? "var(--warning, #d97706)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: 14, position: "relative" }}>
                    <button onClick={() => removeItem(i)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 15 }}>✕</button>

                    <div style={{ marginBottom: 10, position: "relative" }}>
                      <label style={lbl}>Material *</label>
                      {item.materialName && !item.materialId && (
                        <div style={{ fontSize: 11, color: "var(--warning, #d97706)", marginBottom: 4 }}>
                          ⚠ "{item.materialName}" materiallar ro'yxatida topilmadi — qo'lda tanlang
                        </div>
                      )}
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button
            onClick={() => router.push("/requisitions")}
            style={{ flex: 1, padding: "11px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}
          >
            Bekor
          </button>
          <button
            disabled={saving}
            onClick={handleCreate}
            style={{ flex: 2, padding: "11px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Yuborilmoqda…" : "Yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewRequisitionPage() {
  return (
    <Suspense>
      <NewRequisitionContent />
    </Suspense>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 5 };
const errStyle: React.CSSProperties = { fontSize: 11, color: "var(--danger)", marginTop: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text1)", boxSizing: "border-box" };