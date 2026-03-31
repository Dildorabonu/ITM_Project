"use client";

import { useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import * as XLSX from "xlsx";
import {
  productService,
  departmentService,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type ProductResponse,
  type ProductCreatePayload,
  type ProductUpdatePayload,
  type DepartmentOption,
} from "@/lib/userService";
import { useAuthStore } from "@/lib/store/authStore";

interface ParsedImportRow {
  rowNum: number;
  name: string;
  departmentName: string;
  departmentId?: string;
  quantity: number;
  unit: ProductUnit;
  description: string;
  errors: string[];
}

interface ProductForm {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  departmentId: string;
}

const emptyForm: ProductForm = { name: "", description: "", quantity: "", unit: "", departmentId: "" };
const DEPT_PLACEHOLDER_VALUE = "__dept_placeholder__";
const DEPT_ALL_VALUE = "__dept_all__";

export default function ProductsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canCreate = hasPermission("Products.Create");
  const canUpdate = hasPermission("Products.Update");
  const canDelete = hasPermission("Products.Delete");

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [filtered, setFiltered] = useState<ProductResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Inline form
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [forms, setForms] = useState<ProductForm[]>([{ ...emptyForm }]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // View drawer
  const [viewProduct, setViewProduct] = useState<ProductResponse | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // File import
  const [createTab, setCreateTab] = useState<"manual" | "file">("manual");
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importSaveError, setImportSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import row inline editing
  const [editingImportRowIdx, setEditingImportRowIdx] = useState<number | null>(null);
  const [editingImportRowData, setEditingImportRowData] = useState<{
    name: string; departmentId: string; quantity: string; unit: ProductUnit; description: string;
  } | null>(null);

  useDraft(
    "draft_products",
    showForm,
    { form, editTarget },
    (d) => { setForm(d.form); setEditTarget(d.editTarget); setShowForm(true); },
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await productService.getAll();
      setProducts(data);
      setFiltered(data);
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
      products.filter(p => {
        const matchSearch = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          p.departmentName.toLowerCase().includes(q);
        const matchDept = !filterDept || p.departmentId === filterDept;
        return matchSearch && matchDept;
      })
    );
  }, [search, filterDept, products]);

  useEffect(() => {
    if (!showForm) return;
    const handlePopState = () => setShowForm(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showForm]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setForms([{ ...emptyForm }]);
    setFormSubmitted(false);
    setCreateTab("manual");
    setImportRows([]);
    setImportErrors([]);
    setImportSaveError("");
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const openEdit = (p: ProductResponse) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? "", quantity: String(p.quantity), unit: String(p.unit), departmentId: p.departmentId });
    setFormSubmitted(false);
    window.history.pushState({ showForm: true }, "");
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormSubmitted(true);
    setFormError("");

    if (editTarget) {
      // Single edit
      if (!form.name.trim() || !form.departmentId) return;
      setSaving(true);
      try {
        const dept = departments.find(d => d.id === form.departmentId);
        const qty = form.quantity !== "" ? Number(form.quantity) : 0;
        const unitValue = form.unit !== "" ? (Number(form.unit) as ProductUnit) : undefined;
        const payload: ProductUpdatePayload = {
          name: form.name || undefined,
          description: form.description || null,
          quantity: qty,
          unit: unitValue,
          departmentId: form.departmentId || undefined,
        };
        await productService.update(editTarget.id, payload);
        const updated: ProductResponse = {
          ...editTarget,
          name: form.name || editTarget.name,
          description: form.description || null,
          quantity: qty,
          unit: unitValue ?? editTarget.unit,
          departmentId: form.departmentId || editTarget.departmentId,
          departmentName: dept?.name ?? editTarget.departmentName,
        };
        setProducts(prev => prev.map(p => p.id === editTarget.id ? updated : p));
        setShowForm(false);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
      } finally {
        setSaving(false);
      }
    } else {
      // Multi-create: validate all rows
      const valid = forms.every(f => f.name.trim() && f.departmentId);
      if (!valid) return;
      setSaving(true);
      try {
        const payloads: ProductCreatePayload[] = forms.map(f => ({
          name: f.name,
          description: f.description || null,
          quantity: f.quantity !== "" ? Number(f.quantity) : 0,
          unit: f.unit !== "" ? (Number(f.unit) as ProductUnit) : ProductUnit.Dona,
          departmentId: f.departmentId,
        }));

        await productService.createBulk(payloads);

        const created: ProductResponse[] = payloads.map(p => ({
          id: crypto.randomUUID(),
          name: p.name,
          description: p.description ?? null,
          quantity: p.quantity,
          unit: p.unit,
          departmentId: p.departmentId,
          departmentName: departments.find(d => d.id === p.departmentId)?.name ?? "",
          createdAt: new Date().toISOString(),
        }));

        setProducts(prev => [...prev, ...created]);
        setShowForm(false);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        setFormError(msg ?? "Saqlashda xatolik yuz berdi.");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await productService.delete(deleteId);
      setProducts(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch {
      // stay open on error
    } finally {
      setDeleting(false);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Products template
    const headers = ["Mahsulot nomi *", "Bo'lim nomi *", "Miqdor", "O'lchov birligi", "Tavsif"];
    const example = [
      "Printer qog'ozi",
      departments[0]?.name ?? "Bo'lim nomini kiriting",
      "100",
      "Dona",
      "A4 formatdagi qog'oz",
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      ["Ko'rsatma: * belgisi bilan belgilangan ustunlar majburiy. Maksimal 200 ta mahsulot. 3-qatordan boshlab ma'lumot kiriting."],
      headers,
      example,
    ]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, ws, "Mahsulotlar");

    // Sheet 2: Department list
    const deptWs = XLSX.utils.aoa_to_sheet([
      ["Bo'lim nomlari (nusxalash uchun)"],
      ...departments.map(d => [d.name]),
    ]);
    deptWs["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, deptWs, "Bo'limlar");

    // Sheet 3: Unit labels
    const unitWs = XLSX.utils.aoa_to_sheet([
      ["O'lchov birliklari (nusxalash uchun)"],
      ...Object.values(PRODUCT_UNIT_LABELS).map(l => [l]),
    ]);
    unitWs["!cols"] = [{ wch: 25 }];
    XLSX.utils.book_append_sheet(wb, unitWs, "O'lchov birliklari");

    XLSX.writeFile(wb, "mahsulotlar_shablon.xlsx");
  };

  const handleFileUpload = (file: File) => {
    setImportErrors([]);
    setImportRows([]);
    setImportSaveError("");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

        // Skip row 1 (instruction) and row 2 (headers); data starts at row 3
        const dataRows = allRows.slice(2).filter(row =>
          Array.isArray(row) && row.some(c => c !== undefined && c !== null && String(c).trim() !== "")
        );

        if (dataRows.length === 0) {
          setImportErrors(["Faylda ma'lumot topilmadi. 3-qatordan boshlab mahsulotlarni kiriting."]);
          return;
        }
        if (dataRows.length > 200) {
          setImportErrors([`Faylda ${dataRows.length} ta qator bor. Maksimal: 200 ta mahsulot.`]);
          return;
        }

        const deptMap = new Map(departments.map(d => [d.name.toLowerCase().trim(), d]));
        const unitMap = new Map(
          (Object.entries(PRODUCT_UNIT_LABELS) as [string, string][]).map(
            ([k, v]) => [v.toLowerCase().trim(), Number(k) as ProductUnit]
          )
        );

        const parsed: ParsedImportRow[] = dataRows.map((row, i) => {
          const cols = (row as unknown[]).map(c => String(c ?? "").trim());
          const [name, deptName, qty, unitLabel, desc] = cols;
          const errors: string[] = [];

          if (!name) errors.push("Mahsulot nomi kiritilmagan");
          const dept = deptMap.get((deptName ?? "").toLowerCase().trim());
          if (!dept) errors.push(`"${deptName || "(bo'sh)"}" bo'limi topilmadi`);

          const quantity = qty ? Number(qty) : 0;
          if (qty && isNaN(Number(qty))) errors.push("Miqdor noto'g'ri format");

          const unit = unitLabel
            ? (unitMap.get(unitLabel.toLowerCase().trim()) ?? ProductUnit.Dona)
            : ProductUnit.Dona;

          return {
            rowNum: i + 3,
            name: name ?? "",
            departmentName: deptName ?? "",
            departmentId: dept?.id,
            quantity: isNaN(quantity) ? 0 : quantity,
            unit,
            description: desc ?? "",
            errors,
          };
        });

        setImportRows(parsed);
      } catch {
        setImportErrors(["Faylni o'qishda xatolik. Excel formatini tekshiring."]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validRows = importRows.filter(r => r.errors.length === 0 && r.departmentId);
    if (validRows.length === 0) return;
    setImportSaving(true);
    setImportSaveError("");
    try {
      const payloads: ProductCreatePayload[] = validRows.map(r => ({
        name: r.name,
        description: r.description || null,
        quantity: r.quantity,
        unit: r.unit,
        departmentId: r.departmentId!,
      }));
      await productService.createBulk(payloads);
      await load();
      setShowForm(false);
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

  const BULK_LIMIT = 200;

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
      departmentId: row.departmentId ?? "",
      quantity: String(row.quantity),
      unit: row.unit,
      description: row.description,
    });
  };

  const saveEditImportRow = () => {
    if (editingImportRowIdx === null || !editingImportRowData) return;
    const d = editingImportRowData;
    const errors: string[] = [];
    if (!d.name.trim()) errors.push("Mahsulot nomi kiritilmagan");
    const dept = departments.find(dep => dep.id === d.departmentId);
    if (!dept) errors.push(`"${d.departmentId || "(bo'sh)"}" bo'limi topilmadi`);
    const quantity = d.quantity !== "" ? Number(d.quantity) : 0;
    if (d.quantity && isNaN(Number(d.quantity))) errors.push("Miqdor noto'g'ri format");
    setImportRows(prev => prev.map((r, i) => i === editingImportRowIdx ? {
      ...r,
      name: d.name,
      departmentId: dept?.id,
      departmentName: dept?.name ?? r.departmentName,
      quantity: isNaN(quantity) ? 0 : quantity,
      unit: d.unit,
      description: d.description,
      errors,
    } : r));
    setEditingImportRowIdx(null);
    setEditingImportRowData(null);
  };

  const cancelEditImportRow = () => {
    setEditingImportRowIdx(null);
    setEditingImportRowData(null);
  };

  /* ===== Inline form view ===== */
  if (showForm) {
    if (editTarget) {
      // Single edit form
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
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !form.departmentId ? "var(--danger)" : "var(--text2)" }}>
                  Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select className="form-input" value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                  style={{ width: "100%", cursor: "pointer", ...(formSubmitted && !form.departmentId ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : {}) }}>
                  <option value="">— Bo&apos;lim tanlang —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formSubmitted && !form.departmentId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Bo&apos;limni tanlang</div>}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Soni</label>
                <input className="form-input" type="number" min="0" step="any" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
                <select className="form-input" value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  style={{ width: "100%", cursor: "pointer" }}>
                  <option value="">— Tanlang —</option>
                  {(Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => (
                    <option key={key} value={key}>{PRODUCT_UNIT_LABELS[key]}</option>
                  ))}
                </select>
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
            <button onClick={() => setShowForm(false)} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
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
              {tab === "manual" ? "Qo\u2019lda kiritish" : "Fayldan import"}
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
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
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
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="itm-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "center" }}>Qator</th>
                        <th>Mahsulot nomi</th>
                        <th>Bo&apos;lim</th>
                        <th style={{ textAlign: "center" }}>Miqdor</th>
                        <th style={{ textAlign: "center" }}>O&apos;lchov</th>
                        <th>Tavsif</th>
                        <th style={{ textAlign: "center" }}>Holat</th>
                        <th style={{ textAlign: "center" }}>Tahrirlash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row, i) => {
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
                                <select
                                  className="form-input"
                                  title="Bo'lim"
                                  value={editingImportRowData.departmentId}
                                  onChange={e => setEditingImportRowData(d => d && { ...d, departmentId: e.target.value })}
                                  style={{ minWidth: 130, padding: "4px 8px", fontSize: 13, cursor: "pointer" }}
                                >
                                  <option value="">— Tanlang —</option>
                                  {departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="form-input"
                                  type="number" min="0" step="any"
                                  title="Miqdor"
                                  placeholder="0"
                                  value={editingImportRowData.quantity}
                                  onChange={e => setEditingImportRowData(d => d && { ...d, quantity: e.target.value })}
                                  style={{ width: 80, padding: "4px 8px", fontSize: 13 }}
                                />
                              </td>
                              <td>
                                <select
                                  className="form-input"
                                  title="O'lchov birligi"
                                  value={editingImportRowData.unit}
                                  onChange={e => setEditingImportRowData(d => d && { ...d, unit: Number(e.target.value) as ProductUnit })}
                                  style={{ minWidth: 90, padding: "4px 8px", fontSize: 13, cursor: "pointer" }}
                                >
                                  {(Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => (
                                    <option key={key} value={key}>{PRODUCT_UNIT_LABELS[key]}</option>
                                  ))}
                                </select>
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
                            <td style={row.errors.some(e => e.includes("nomi")) ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
                              {row.name || <span style={{ color: "var(--text3)" }}>—</span>}
                            </td>
                            <td>{row.departmentName || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                            <td style={{ textAlign: "center" }}>{row.quantity}</td>
                            <td style={{ textAlign: "center" }}>{PRODUCT_UNIT_LABELS[row.unit]}</td>
                            <td style={{ color: "var(--text2)", fontSize: 12 }}>{row.description || "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              {row.errors.length === 0 ? (
                                <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>✓</span>
                              ) : (
                                <span title={row.errors.join("; ")} style={{ color: "var(--danger)", fontSize: 12, cursor: "help", fontWeight: 600 }}>
                                  ✗ {row.errors[0]}
                                </span>
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
                onClick={() => setShowForm(false)}
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
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: formSubmitted && !f.departmentId ? "var(--danger)" : "var(--text2)" }}>
                  Bo&apos;lim <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select className="form-input" value={f.departmentId}
                  onChange={e => updateFormRow(index, "departmentId", e.target.value)}
                  style={{ width: "100%", cursor: "pointer", ...(formSubmitted && !f.departmentId ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 2px var(--danger)33" } : {}) }}>
                  <option value="">— Bo&apos;lim tanlang —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formSubmitted && !f.departmentId && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Bo&apos;limni tanlang</div>}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>Soni</label>
                <input className="form-input" type="number" min="0" step="any" value={f.quantity}
                  onChange={e => updateFormRow(index, "quantity", e.target.value)} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text2)" }}>O&apos;lchov birligi</label>
                <select className="form-input" value={f.unit}
                  onChange={e => updateFormRow(index, "unit", e.target.value)}
                  style={{ width: "100%", cursor: "pointer" }}>
                  <option value="">— Tanlang —</option>
                  {(Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(key => (
                    <option key={key} value={key}>{PRODUCT_UNIT_LABELS[key]}</option>
                  ))}
                </select>
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
          <button onClick={() => setShowForm(false)} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
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

  /* ===== List view ===== */
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="form-input"
          value={DEPT_PLACEHOLDER_VALUE}
          onChange={e => {
            const value = e.target.value;
            setFilterDept(value === DEPT_PLACEHOLDER_VALUE || value === DEPT_ALL_VALUE ? "" : value);
          }}
          style={{ width: 200, cursor: "pointer", height: 36, padding: "0 10px", fontSize: 14, fontWeight: 600 }}
        >
          <option value={DEPT_PLACEHOLDER_VALUE} hidden>Bo&apos;limlar</option>
          <option value={DEPT_ALL_VALUE}>Barcha bo&apos;limlar</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          className="btn-icon"
          onClick={load}
          title="Yangilash"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        {canCreate && (
          <button
            className="btn-primary"
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yaratish
          </button>
        )}
      </div>

      <div className="itm-card" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#e05252" }}>{error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Mahsulot nomi</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Bo&apos;lim</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Soni</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>O&apos;lchov</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Tavsif</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Ma&apos;lumot topilmadi</td></tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ textAlign: "center" }}>{p.name}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.departmentName}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.quantity}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{PRODUCT_UNIT_LABELS[p.unit] ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "var(--text1)" }}>{p.description ?? "—"}</td>
                    <td style={{ borderLeft: "2px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button className="btn-icon" title="Ko'rish" onClick={() => setViewProduct(p)}
                          style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {(canUpdate || canDelete) && (
                          <>
                            {canUpdate && (
                              <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(p)}
                                style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button className="btn-icon btn-icon-danger" title="O'chirish"
                                style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}
                                onClick={() => setDeleteId(p.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View drawer */}
      {viewProduct && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setViewProduct(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 720, maxWidth: "95vw", height: "calc(100% - 32px)", margin: "16px 16px 16px 0",
              background: "var(--bg2)", borderRadius: 14,
              boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
              padding: "28px 28px 32px", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text1)" }}>Mahsulot tafsilotlari</span>
              <button onClick={() => setViewProduct(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Umumiy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ gridColumn: "1 / -1", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Mahsulot nomi</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewProduct.name}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Bo&apos;lim</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{viewProduct.departmentName}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Soni</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{viewProduct.quantity}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>O&apos;lchov birligi</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{PRODUCT_UNIT_LABELS[viewProduct.unit] ?? "—"}</div>
              </div>
              <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Yaratilgan sana</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>
                  {(() => { const d = viewProduct.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—"; })()}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 10 }}>Tavsif</div>
            <div style={{ border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
              <div style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>{viewProduct.description || "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 28, width: 340, maxWidth: "95vw", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, marginBottom: 8 }}>Mahsulotni o&apos;chirish</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              Ushbu mahsulot o&apos;chiriladi. Davom etasizmi?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-outline" onClick={() => setDeleteId(null)} disabled={deleting}>Bekor</button>
              <button className="btn" style={{ background: "#e05252", color: "#fff", border: "none" }}
                onClick={handleDelete} disabled={deleting}>
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

