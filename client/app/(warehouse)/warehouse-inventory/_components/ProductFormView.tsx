"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  productService,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type ProductResponse,
  type ProductCreatePayload,
  type ProductUpdatePayload,
  type ProductDuplicateCheckResult,
  type DepartmentOption,
} from "@/lib/userService";
import { CheckSelect } from "@/app/_components/CheckSelect";
import { SimilarNameWarning } from "./SimilarNameWarning";
import {
  emptyForm,
  UNIT_OPTIONS,
  BULK_LIMIT,
  type ProductForm,
  type ParsedImportRow,
  type RowError,
} from "../_types";
import { downloadProductsTemplate, parseProductsExcel } from "../_utils/productExcel";

interface Props {
  editTarget: ProductResponse | null;
  departments: DepartmentOption[];
  // Single-edit forma holati sahifada turadi (useDraft bilan saqlanadi).
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  onClose: () => void;
  // Create/import muvaffaqiyatli bo'lganda asosiy ro'yxatni qayta yuklash uchun.
  onCreated: () => void | Promise<void>;
  // Tahrir muvaffaqiyatli bo'lganda ro'yxatdagi qatorni joyida yangilash uchun.
  onUpdated: (updated: ProductResponse) => void;
}

// Import preview qatorlari holat bo'yicha tartiblanadi: avval xatolar (qizil),
// keyin o'xshashlik ogohlantirishi (sariq), oxirida toza qatorlar (yashil).
function statusRank(r: ParsedImportRow): number {
  if (r.errors.length > 0) return 0;
  if (r.similar && r.similar.length > 0) return 1;
  return 2;
}

// Yangi mahsulot(lar) yaratish (qo'lda yoki Excel import) hamda mavjud
// mahsulotni tahrirlash formasi. Ko'p qatorli create va import holatini o'zi boshqaradi.
export function ProductFormView({ editTarget, departments, form, setForm, onClose, onCreated, onUpdated }: Props) {
  const [forms, setForms] = useState<ProductForm[]>([{ ...emptyForm }]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [createTab, setCreateTab] = useState<"manual" | "file">("manual");
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importSaveError, setImportSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingImportRowIdx, setEditingImportRowIdx] = useState<number | null>(null);
  const [editingImportRowData, setEditingImportRowData] = useState<{
    name: string; invoiceNumber: string; departmentId: string; quantity: string; unit: ProductUnit; description: string;
  } | null>(null);

  const handleSave = async () => {
    setFormSubmitted(true);
    setFormError("");

    if (editTarget) {
      // Single edit
      if (!form.name.trim() || !form.invoiceNumber.trim() || !form.departmentId) return;
      setSaving(true);
      try {
        const dept = departments.find(d => d.id === form.departmentId);
        const qty = form.quantity !== "" ? Number(form.quantity) : 0;
        const unitValue = form.unit !== "" ? (Number(form.unit) as ProductUnit) : undefined;
        const payload: ProductUpdatePayload = {
          name: form.name || undefined,
          invoiceNumber: form.invoiceNumber.trim() || undefined,
          description: form.description || null,
          quantity: qty,
          unit: unitValue,
          departmentId: form.departmentId || undefined,
        };
        await productService.update(editTarget.id, payload);
        const updated: ProductResponse = {
          ...editTarget,
          name: form.name || editTarget.name,
          invoiceNumber: form.invoiceNumber.trim() || editTarget.invoiceNumber,
          description: form.description || null,
          quantity: qty,
          unit: unitValue ?? editTarget.unit,
          departmentId: form.departmentId || editTarget.departmentId,
          departmentName: dept?.name ?? editTarget.departmentName,
        };
        onUpdated(updated);
        onClose();
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
      } finally {
        setSaving(false);
      }
    } else {
      // Multi-create: validate all rows
      const valid = forms.every(f => f.name.trim() && f.invoiceNumber.trim() && f.departmentId);
      if (!valid) return;

      // Check for duplicate invoice numbers within the form batch
      const invoices = forms.map(f => f.invoiceNumber.trim().toLowerCase());
      const dupInvoice = invoices.find((v, i) => invoices.indexOf(v) !== i);
      if (dupInvoice) {
        setFormError(`Invoice raqami "${dupInvoice}" yuborilayotgan ro'yxatda takrorlangan.`);
        return;
      }

      setSaving(true);
      try {
        const payloads: ProductCreatePayload[] = forms.map(f => ({
          name: f.name,
          invoiceNumber: f.invoiceNumber.trim(),
          description: f.description || null,
          quantity: f.quantity !== "" ? Number(f.quantity) : 0,
          unit: f.unit !== "" ? (Number(f.unit) as ProductUnit) : ProductUnit.Dona,
          departmentId: f.departmentId,
        }));

        await productService.createBulk(payloads);
        onClose();
        await onCreated();
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
      } finally {
        setSaving(false);
      }
    }
  };

  const downloadTemplate = () => downloadProductsTemplate(departments);

  const handleFileUpload = async (file: File) => {
    setImportErrors([]);
    setImportRows([]);
    setImportSaveError("");
    const { rows, errors } = await parseProductsExcel(file, departments);
    if (errors.length > 0) {
      setImportErrors(errors);
      return;
    }
    setImportRows(rows);
    // Bazadagi / fayl ichidagi dublikat va o'xshashlarni backendda tekshiramiz.
    void runDuplicateCheck(rows);
  };

  // Import preview qatorlari uchun dublikat tekshiruvi: aniq dublikat (bazada yoki
  // fayl ichida) qator xatosiga aylanadi (import bloklanadi); o'xshashlar esa
  // ogohlantirish sifatida saqlanadi (bloklamaydi).
  const runDuplicateCheck = async (rows: ParsedImportRow[]) => {
    const items = rows
      .map((r, i) => ({ index: i, name: r.name, invoiceNumber: r.invoiceNumber, departmentId: r.departmentId ?? "" }))
      .filter(it => it.name.trim() && it.departmentId);
    if (items.length === 0) return;

    try {
      const res = await productService.checkDuplicates(items);
      const byIndex = new Map<number, ProductDuplicateCheckResult>(res.map(r => [r.index, r]));
      setImportRows(prev => prev.map((row, i) => {
        const r = byIndex.get(i);
        if (!r) return row;
        const errors = [...row.errors];
        if (r.exactDuplicate)
          errors.push({ field: "name", message: `Bu bo'limda shu nomli mahsulot allaqachon bor (mavjud: ${r.exactDuplicate.invoiceNumber})` });
        if (r.duplicateInFile)
          errors.push({ field: "name", message: "Shu nom faylda takrorlangan" });
        if (r.invoiceDuplicate)
          errors.push({ field: "invoice", message: "Bu invoice raqami bazada allaqachon mavjud" });
        return { ...row, errors, similar: r.similar };
      }));
    } catch {
      /* tekshiruv xatosi — importni to'xtatmaymiz */
    }
  };

  const handleImport = async () => {
    const validRows = importRows.filter(r => r.errors.length === 0 && r.departmentId);
    if (validRows.length === 0) return;
    setImportSaving(true);
    setImportSaveError("");
    try {
      const payloads: ProductCreatePayload[] = validRows.map(r => ({
        name: r.name,
        invoiceNumber: r.invoiceNumber.trim(),
        description: r.description || null,
        quantity: r.quantity,
        unit: r.unit,
        departmentId: r.departmentId!,
      }));
      await productService.createBulk(payloads);
      await onCreated();
      onClose();
      setImportRows([]);
      setImportErrors([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      setImportSaveError(msg ?? "Saqlashda xatolik yuz berdi.");
    } finally {
      setImportSaving(false);
    }
  };

  const updateFormRow = (index: number, field: keyof ProductForm, value: string) => {
    setForms(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const addFormRow = () => {
    setForms(prev => prev.length < BULK_LIMIT ? [...prev, { ...emptyForm }] : prev);
  };

  const removeFormRow = (index: number) => {
    setForms(prev => prev.filter((_, i) => i !== index));
  };

  const startEditImportRow = (idx: number) => {
    const row = importRows[idx];
    setEditingImportRowIdx(idx);
    setEditingImportRowData({
      name: row.name,
      invoiceNumber: row.invoiceNumber,
      departmentId: row.departmentId ?? "",
      quantity: String(row.quantity),
      unit: row.unit,
      description: row.description,
    });
  };

  const saveEditImportRow = () => {
    if (editingImportRowIdx === null || !editingImportRowData) return;
    const d = editingImportRowData;
    const dept = departments.find(dep => dep.id === d.departmentId);
    const quantity = d.quantity !== "" ? Number(d.quantity) : 0;

    const updated = importRows.map((r, i) => i === editingImportRowIdx ? {
      ...r,
      name: d.name,
      invoiceNumber: d.invoiceNumber,
      departmentId: dept?.id,
      departmentName: dept?.name ?? r.departmentName,
      quantity: isNaN(quantity) ? 0 : quantity,
      unit: d.unit,
      description: d.description,
      errors: [] as RowError[],
      similar: undefined,
    } : r);

    // Recompute invoice duplicates across the whole batch
    const invCounts = new Map<string, number>();
    for (const r of updated) {
      const k = r.invoiceNumber.trim().toLowerCase();
      if (k) invCounts.set(k, (invCounts.get(k) ?? 0) + 1);
    }

    const revalidated = updated.map(r => {
      const errors: RowError[] = [];
      if (!r.name.trim()) errors.push({ field: "name", message: "Mahsulot nomi kiritilmagan" });
      if (!r.invoiceNumber.trim()) errors.push({ field: "invoice", message: "Invoice raqami kiritilmagan" });
      const dep = departments.find(x => x.id === r.departmentId);
      if (!dep) errors.push({ field: "department", message: `"${r.departmentName || "(bo'sh)"}" bo'limi topilmadi` });
      const k = r.invoiceNumber.trim().toLowerCase();
      if (k && (invCounts.get(k) ?? 0) > 1) {
        errors.push({ field: "invoice", message: `Invoice raqami "${r.invoiceNumber}" faylda takrorlangan` });
      }
      return { ...r, errors };
    });

    setImportRows(revalidated);
    setEditingImportRowIdx(null);
    setEditingImportRowData(null);
    // Tahrirdan keyin dublikat/o'xshashlikni qayta tekshiramiz.
    void runDuplicateCheck(revalidated);
  };

  const cancelEditImportRow = () => {
    setEditingImportRowIdx(null);
    setEditingImportRowData(null);
  };

  /* ===== Single edit form ===== */
  if (editTarget) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Mahsulotni tahrirlash</span>
        </div>
        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !form.name.trim() ? "var(--danger)" : "var(--text2)" }}>
                Mahsulot nomi <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mahsulot nomini kiriting"
                style={formSubmitted && !form.name.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
              />
              {formSubmitted && !form.name.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Mahsulot nomini kiriting</div>}
              <SimilarNameWarning name={form.name} departmentId={form.departmentId} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !form.invoiceNumber.trim() ? "var(--danger)" : "var(--text2)" }}>
                Invoice raqami <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input className="form-input" value={form.invoiceNumber}
                onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                placeholder="Masalan: INV-2026-0001"
                style={formSubmitted && !form.invoiceNumber.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33", fontFamily: "var(--font-mono)" } : { fontFamily: "var(--font-mono)" }}
              />
              {formSubmitted && !form.invoiceNumber.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Invoice raqamini kiriting</div>}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !form.departmentId ? "var(--danger)" : "var(--text2)" }}>
                Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <CheckSelect
                value={form.departmentId}
                onChange={v => setForm(f => ({ ...f, departmentId: v }))}
                options={departments.map(d => ({ id: d.id, name: d.name }))}
                placeholder="— Bo'lim tanlang —"
                error={formSubmitted && !form.departmentId}
              />
              {formSubmitted && !form.departmentId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Bo&apos;limni tanlang</div>}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Soni</label>
              <input className="form-input" type="number" min="0" step="any" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                onWheel={e => (e.target as HTMLInputElement).blur()} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
              <CheckSelect
                value={form.unit}
                onChange={v => setForm(f => ({ ...f, unit: v }))}
                options={UNIT_OPTIONS}
                placeholder="— Tanlang —"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Tavsif</label>
              <textarea className="form-input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Mahsulot tavsifini kiriting (ixtiyoriy)" rows={3} style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>
        {formError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
            {formError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
          <button onClick={onClose} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Saqlanmoqda..." : "O'zgarishlarni saqlash"}
          </button>
        </div>
      </div>
    );
  }

  // Multi-create / file-import form
  const importValidRows = importRows.filter(r => r.errors.length === 0);
  const importErrorRows = importRows.filter(r => r.errors.length > 0);
  const importWarnRows = importRows.filter(r => r.errors.length === 0 && r.similar && r.similar.length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi mahsulot(lar)</span>
        {createTab === "manual" && (
          <span style={{ fontSize: 13, color: "var(--text2)" }}>{forms.length} ta mahsulot</span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {(["manual", "file"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setCreateTab(tab)}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "none", background: "none",
              color: createTab === tab ? "var(--accent)" : "var(--text3)",
              borderBottom: createTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2, transition: "color 0.15s",
            }}
          >
            {tab === "manual" ? "Qo’lda kiritish" : "Fayldan import"}
          </button>
        ))}
      </div>

      {createTab === "file" && (
        <>
          {/* Step 1: Download template */}
          <div className="itm-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>
              1-qadam: Namuna faylni yuklab oling, to&apos;ldiring
            </div>
            <button
              onClick={downloadTemplate}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 20px", borderRadius: "var(--radius)",
                background: "var(--accent-dim)", border: "1.5px solid var(--accent)44",
                color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Namuna faylni yuklash (.xlsx)
            </button>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
              Fayl 3 ta varaq o&apos;z ichiga oladi: Mahsulotlar (to&apos;ldirish uchun), Bo&apos;limlar va O&apos;lchov birliklari (ma&apos;lumotnoma).
            </div>
          </div>

          {/* Step 2: Upload file */}
          <div className="itm-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>
              2-qadam: To&apos;ldirilgan faylni yuklang
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleFileUpload(file);
              }}
              style={{
                border: "2px dashed var(--border)", borderRadius: "var(--radius)",
                padding: "32px 20px", textAlign: "center", cursor: "pointer",
                background: "var(--bg3)", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 500 }}>Faylni bu yerga tashlang yoki bosing</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>.xlsx, .xls, .csv formatlar qabul qilinadi</div>
            </div>
          </div>

          {/* Parse errors */}
          {importErrors.length > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Parsed preview */}
          {importRows.length > 0 && (
            <div className="itm-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Natija: {importRows.length} ta qator</span>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "#22c55e22", color: "#22c55e", fontWeight: 600 }}>
                  {importValidRows.length} ta to&apos;g&apos;ri
                </span>
                {importErrorRows.length > 0 && (
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "var(--danger-dim)", color: "var(--danger)", fontWeight: 600 }}>
                    {importErrorRows.length} ta xatolik
                  </span>
                )}
                {importWarnRows.length > 0 && (
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "var(--warn-dim)", color: "var(--warn)", fontWeight: 600 }}>
                    {importWarnRows.length} ta o&apos;xshash
                  </span>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="itm-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>Qator</th>
                      <th style={{ textAlign: "center" }}>Mahsulot nomi</th>
                      <th style={{ textAlign: "center" }}>Invoice raqami</th>
                      <th style={{ textAlign: "center" }}>Bo&apos;lim</th>
                      <th style={{ textAlign: "center" }}>Miqdor</th>
                      <th style={{ textAlign: "center" }}>O&apos;lchov</th>
                      <th style={{ textAlign: "center" }}>Tavsif</th>
                      <th style={{ textAlign: "center" }}>Holat</th>
                      <th style={{ textAlign: "center" }}>Tahrirlash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows
                      .map((row, originalIndex) => ({ row, originalIndex }))
                      .sort((a, b) => statusRank(a.row) - statusRank(b.row))
                      .map(({ row, originalIndex: i }) => {
                      const isEditing = editingImportRowIdx === i && editingImportRowData !== null;
                      if (isEditing && editingImportRowData) {
                        return (
                          <tr key={row.rowNum} style={{ background: "var(--accent-dim)" }}>
                            <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{row.rowNum}</td>
                            <td>
                              <input
                                className="form-input"
                                title="Mahsulot nomi"
                                placeholder="Mahsulot nomi"
                                value={editingImportRowData.name}
                                onChange={e => setEditingImportRowData(d => d && { ...d, name: e.target.value })}
                                style={{ minWidth: 130, padding: "4px 8px", fontSize: 13 }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                title="Invoice raqami"
                                placeholder="INV-…"
                                value={editingImportRowData.invoiceNumber}
                                onChange={e => setEditingImportRowData(d => d && { ...d, invoiceNumber: e.target.value })}
                                style={{ minWidth: 130, padding: "4px 8px", fontSize: 13, fontFamily: "var(--font-mono)" }}
                              />
                            </td>
                            <td>
                              <CheckSelect
                                value={editingImportRowData.departmentId}
                                onChange={v => setEditingImportRowData(d => d && { ...d, departmentId: v })}
                                options={departments.map(dep => ({ id: dep.id, name: dep.name }))}
                                placeholder="— Tanlang —"
                                style={{ minWidth: 130 }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number" min="0" step="any"
                                title="Miqdor"
                                placeholder="0"
                                value={editingImportRowData.quantity}
                                onChange={e => setEditingImportRowData(d => d && { ...d, quantity: e.target.value })}
                                onWheel={e => (e.target as HTMLInputElement).blur()}
                                style={{ width: 80, padding: "4px 8px", fontSize: 13 }}
                              />
                            </td>
                            <td>
                              <CheckSelect
                                value={String(editingImportRowData.unit)}
                                onChange={v => setEditingImportRowData(d => d && { ...d, unit: Number(v) as ProductUnit })}
                                options={UNIT_OPTIONS}
                                placeholder="— Tanlang —"
                                style={{ minWidth: 90 }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                title="Tavsif"
                                placeholder="Tavsif"
                                value={editingImportRowData.description}
                                onChange={e => setEditingImportRowData(d => d && { ...d, description: e.target.value })}
                                style={{ minWidth: 120, padding: "4px 8px", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>—</td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  onClick={saveEditImportRow}
                                  title="Saqlash"
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                    background: "#22c55e22", border: "1px solid #22c55e44",
                                    color: "#22c55e", cursor: "pointer",
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Saqlash
                                </button>
                                <button
                                  onClick={cancelEditImportRow}
                                  title="Bekor"
                                  style={{
                                    display: "inline-flex", alignItems: "center",
                                    padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                    background: "var(--bg3)", border: "1px solid var(--border)",
                                    color: "var(--text2)", cursor: "pointer",
                                  }}
                                >✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={row.rowNum} style={row.errors.length > 0 ? { background: "var(--danger-dim)" } : undefined}>
                          <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{row.rowNum}</td>
                          <td style={row.errors.some(e => e.field === "name") ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
                            {row.name || <span style={{ color: "var(--text3)" }}>—</span>}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, ...(row.errors.some(e => e.field === "invoice") ? { color: "var(--danger)", fontWeight: 600 } : {}) }}>
                            {row.invoiceNumber || <span style={{ color: "var(--text3)", fontFamily: "var(--font-inter)" }}>—</span>}
                          </td>
                          <td>{row.departmentName || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                          <td style={{ textAlign: "center" }}>{row.quantity}</td>
                          <td style={{ textAlign: "center" }}>{PRODUCT_UNIT_LABELS[row.unit]}</td>
                          <td style={{ color: "var(--text2)", fontSize: 12 }}>{row.description || "—"}</td>
                          <td style={{ textAlign: "center", whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}>
                            {row.errors.length === 0 ? (
                              row.similar && row.similar.length > 0 ? (
                                <span style={{ lineHeight: 1.35, color: "var(--warn)", fontSize: 11, fontWeight: 600 }}>
                                  ⚠ o&apos;xshash: {row.similar[0].name}
                                </span>
                              ) : (
                                <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>✓</span>
                              )
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start", textAlign: "left" }}>
                                {row.errors.map((e, ei) => (
                                  <span key={ei} style={{ lineHeight: 1.35, color: "var(--danger)", fontSize: 12, fontWeight: 600 }}>
                                    ✗ {e.message}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button
                                onClick={() => startEditImportRow(i)}
                                title="Tahrirlash"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                  background: "#3b82f622", border: "1px solid #3b82f644",
                                  color: "#3b82f6", cursor: "pointer",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Tahrir
                              </button>
                              <button
                                onClick={() => setImportRows(prev => prev.filter((_, idx) => idx !== i))}
                                title="O'chirish"
                                style={{
                                  display: "inline-flex", alignItems: "center",
                                  padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                  background: "var(--danger-dim)", border: "1px solid var(--danger)44",
                                  color: "var(--danger)", cursor: "pointer",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importSaveError && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
              {importSaveError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}
            >
              Bekor qilish
            </button>
            {importValidRows.length > 0 && (
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={importSaving}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {importSaving ? "Yuklanmoqda..." : `${importValidRows.length} ta mahsulotni import qilish`}
              </button>
            )}
          </div>
        </>
      )}

      {createTab === "manual" && (
        <>
          {forms.map((f, index) => (
            <div key={index} className="itm-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text2)" }}>
                  #{index + 1} mahsulot
                </span>
                {forms.length > 1 && (
                  <button
                    onClick={() => removeFormRow(index)}
                    title="Olib tashlash"
                    style={{
                      background: "var(--danger-dim)", border: "1px solid var(--danger)33",
                      borderRadius: 6, cursor: "pointer", padding: "4px 10px",
                      color: "var(--danger)", fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Olib tashlash
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !f.name.trim() ? "var(--danger)" : "var(--text2)" }}>
                    Mahsulot nomi <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input className="form-input" value={f.name}
                    onChange={e => updateFormRow(index, "name", e.target.value)}
                    placeholder="Mahsulot nomini kiriting"
                    style={formSubmitted && !f.name.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : undefined}
                  />
                  {formSubmitted && !f.name.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Mahsulot nomini kiriting</div>}
                  <SimilarNameWarning name={f.name} departmentId={f.departmentId} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !f.invoiceNumber.trim() ? "var(--danger)" : "var(--text2)" }}>
                    Invoice raqami <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input className="form-input" value={f.invoiceNumber}
                    onChange={e => updateFormRow(index, "invoiceNumber", e.target.value)}
                    placeholder="Masalan: INV-2026-0001"
                    style={formSubmitted && !f.invoiceNumber.trim() ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33", fontFamily: "var(--font-mono)" } : { fontFamily: "var(--font-mono)" }}
                  />
                  {formSubmitted && !f.invoiceNumber.trim() && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Invoice raqamini kiriting</div>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !f.departmentId ? "var(--danger)" : "var(--text2)" }}>
                    Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <CheckSelect
                    value={f.departmentId}
                    onChange={v => updateFormRow(index, "departmentId", v)}
                    options={departments.map(d => ({ id: d.id, name: d.name }))}
                    placeholder="— Bo'lim tanlang —"
                    error={formSubmitted && !f.departmentId}
                  />
                  {formSubmitted && !f.departmentId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Bo&apos;limni tanlang</div>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Soni</label>
                  <input className="form-input" type="number" min="0" step="any" value={f.quantity}
                    onChange={e => updateFormRow(index, "quantity", e.target.value)}
                    onWheel={e => (e.target as HTMLInputElement).blur()} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
                  <CheckSelect
                    value={f.unit}
                    onChange={v => updateFormRow(index, "unit", v)}
                    options={UNIT_OPTIONS}
                    placeholder="— Tanlang —"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Tavsif</label>
                  <textarea className="form-input" value={f.description}
                    onChange={e => updateFormRow(index, "description", e.target.value)}
                    placeholder="Mahsulot tavsifini kiriting (ixtiyoriy)" rows={2} style={{ resize: "vertical" }} />
                </div>
              </div>
            </div>
          ))}

          {/* Add row button */}
          {forms.length < BULK_LIMIT ? (
            <button
              onClick={addFormRow}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", borderRadius: "var(--radius)",
                border: "2px dashed var(--border)", background: "transparent",
                color: "var(--accent)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-dim)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Yana mahsulot qo&apos;shish
            </button>
          ) : (
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", padding: "10px 0" }}>
              Maksimal chegara: bir vaqtda 200 ta mahsulot qo&apos;shish mumkin
            </div>
          )}

          {/* Footer */}
          {formError && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--danger-dim)", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 13 }}>
              {formError}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
            <button onClick={onClose} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
              Bekor qilish
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? "Saqlanmoqda..." : `${forms.length} ta mahsulot saqlash`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
