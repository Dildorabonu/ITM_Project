"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  manufacturedProductService,
  ManufacturingStatus,
  ProductUnit,
  type ManufacturedProductResponse,
  type ManufacturedProductCreatePayload,
  type DepartmentOption,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { useToastStore } from "@/lib/store/toastStore";
import { emptyForm, STATUS_OPTIONS, UNIT_OPTIONS, type ProductForm } from "../_types";
import { FormField } from "./FormField";

interface Props {
  editTarget: ManufacturedProductResponse | null;
  departments: DepartmentOption[];
  onClose: () => void;
  // Saqlangach asosiy ro'yxat va statistikani yangilash uchun chaqiriladi.
  onSaved: () => void | Promise<void>;
}

function initialForm(editTarget: ManufacturedProductResponse | null): ProductForm {
  if (!editTarget) return emptyForm;
  return {
    name: editTarget.name,
    code: editTarget.code ?? "",
    departmentId: editTarget.departmentId,
    quantity: String(editTarget.quantity),
    producedQuantity: String(editTarget.producedQuantity),
    unit: String(editTarget.unit),
    status: String(editTarget.status),
    startedAt: editTarget.startedAt ? editTarget.startedAt.slice(0, 10) : "",
    completedAt: editTarget.completedAt ? editTarget.completedAt.slice(0, 10) : "",
    description: editTarget.description ?? "",
    notes: editTarget.notes ?? "",
  };
}

// Tayyor mahsulotni qo'lda yaratish yoki tahrirlash drawer formasi.
export function ManufacturedFormDrawer({ editTarget, departments, onClose, onSaved }: Props) {
  const showToast = useToastStore(s => s.show);

  const [form, setForm] = useState<ProductForm>(() => initialForm(editTarget));
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const close = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    setFormSubmitted(true);
    const qty = Number(form.quantity);
    const produced = Number(form.producedQuantity || "0");

    if (!form.name.trim() || !form.departmentId || !form.unit || !form.quantity ||
        Number.isNaN(qty) || qty < 0 || Number.isNaN(produced) || produced < 0) {
      return;
    }
    if (produced > qty) {
      setFormError("Bajarilgan miqdor umumiy miqdordan ko'p bo'lishi mumkin emas.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload: ManufacturedProductCreatePayload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        quantity: qty,
        producedQuantity: produced,
        unit: Number(form.unit) as ProductUnit,
        status: Number(form.status) as ManufacturingStatus,
        departmentId: form.departmentId,
        startedAt: form.startedAt || null,
        completedAt: form.completedAt || null,
        notes: form.notes.trim() || null,
      };

      if (editTarget) {
        await manufacturedProductService.update(editTarget.id, payload);
        showToast("Mahsulot yangilandi");
      } else {
        await manufacturedProductService.create(payload);
        showToast("Mahsulot qo'shildi");
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { errors?: string[]; message?: string } } })
        ?.response?.data?.errors?.[0]
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Saqlashda xatolik yuz berdi.";
      setFormError(msg);
      setSaving(false);
      return;
    }

    setSaving(false);
    await onSaved();
    onClose();
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxWidth: "95vw", height: "calc(100vh - 32px)", margin: "16px 16px 16px 0",
          background: "var(--bg2)", borderRadius: 14,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          padding: "28px 28px 24px", overflowY: "auto",
          animation: "panel-appear 0.28s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>
            {editTarget ? "Mahsulotni tahrirlash" : "Yangi mahsulot qo'shish"}
          </span>
          <button onClick={close}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {formError && (
          <div style={{
            marginBottom: 14, padding: "10px 14px",
            background: "var(--danger-dim)", border: "1px solid var(--danger)33",
            borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13,
          }}>{formError}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FormField label="Mahsulot nomi" required error={formSubmitted && !form.name.trim()}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="form-input"
              placeholder="Masalan: Maxsus paket"
            />
          </FormField>
          <FormField label="Kod / Artikul">
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="form-input"
              placeholder="Ixtiyoriy"
            />
          </FormField>

          <FormField label="Bo'lim" required error={formSubmitted && !form.departmentId}>
            <CheckSelect
              value={form.departmentId}
              onChange={v => setForm(f => ({ ...f, departmentId: v }))}
              options={departments.map(d => ({ id: d.id, name: d.name }))}
              placeholder="Bo'limni tanlang"
            />
          </FormField>
          <FormField label="O'lchov birligi" required error={formSubmitted && !form.unit}>
            <CheckSelect
              value={form.unit}
              onChange={v => setForm(f => ({ ...f, unit: v }))}
              options={UNIT_OPTIONS}
              placeholder="O'lchov"
            />
          </FormField>

          <FormField label="Umumiy miqdor" required error={formSubmitted && (!form.quantity || Number(form.quantity) < 0)}>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="form-input"
              placeholder="0"
            />
          </FormField>
          <FormField label="Bajarilgan miqdor">
            <input
              type="number"
              min="0"
              step="any"
              value={form.producedQuantity}
              onChange={e => setForm(f => ({ ...f, producedQuantity: e.target.value }))}
              className="form-input"
              placeholder="0"
            />
          </FormField>

          <FormField label="Holati">
            <CheckSelect
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUS_OPTIONS}
              placeholder="Holat"
            />
          </FormField>
          <div />

          <FormField label="Boshlangan sana">
            <input
              type="date"
              value={form.startedAt}
              onChange={e => setForm(f => ({ ...f, startedAt: e.target.value }))}
              className="form-input"
            />
          </FormField>
          <FormField label="Tugallangan sana">
            <input
              type="date"
              value={form.completedAt}
              onChange={e => setForm(f => ({ ...f, completedAt: e.target.value }))}
              className="form-input"
            />
          </FormField>

          <div style={{ gridColumn: "1 / -1" }}>
            <FormField label="Tavsif">
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="form-input"
                rows={2}
                style={{ resize: "vertical", minHeight: 60 }}
                placeholder="Mahsulot haqida qisqacha"
              />
            </FormField>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField label="Izoh">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="form-input"
                rows={2}
                style={{ resize: "vertical", minHeight: 60 }}
                placeholder="Ichki eslatma"
              />
            </FormField>
          </div>
        </div>

        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 10,
          marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)",
        }}>
          <button
            onClick={close}
            disabled={saving}
            style={{
              padding: "8px 18px", borderRadius: "var(--radius)",
              border: "1.5px solid var(--border2)", background: "transparent",
              color: "var(--text2)", fontSize: 13, fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 22px", borderRadius: "var(--radius)",
              border: "none", background: "var(--accent)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saqlanmoqda..." : editTarget ? "Saqlash" : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
