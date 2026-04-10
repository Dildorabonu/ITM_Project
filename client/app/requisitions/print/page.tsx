"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  contractService,
  departmentService,
  costNormService,
  DrawingStatus,
  RequisitionType,
  ProductUnit,
  PRODUCT_UNIT_LABELS_CYR,
  type ContractResponse,
  type DepartmentResponse,
} from "@/lib/userService";

interface TableRow {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  spec: string;
  notes: string;
  image: string; // base64 data URL
}

const emptyRow = (id: number): TableRow => ({ id, name: "", unit: "", quantity: "", spec: "", notes: "", image: "" });

export default function RequisitionPrintPage() {
  const router = useRouter();
  const docRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLSpanElement>(null);
  const showToast = useToastStore((s) => s.show);

  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<TableRow[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signDate, setSignDate] = useState(new Date().toLocaleDateString("ru-RU").replace(/\//g, "."));

  const [type, setType] = useState<RequisitionType>(RequisitionType.Contract);
  const [contractId, setContractId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  const [saving, setSaving] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [normLoading, setNormLoading] = useState(false);

  const fillFromNorm = async () => {
    if (!contractId) return;
    setNormLoading(true);
    try {
      const norms = await costNormService.getAll(contractId);
      const norm =
        norms.find(n => n.isActive && n.status === DrawingStatus.Approved) ??
        norms.find(n => n.isActive) ??
        norms[0];
      if (!norm) { showToast("Bu shartnoma uchun me'yoriy sarf topilmadi", "Xatolik"); return; }
      const qty = norm.contractQuantity;
      const lines = norm.items.filter(i => !i.isSection && i.totalQty);
      if (!lines.length) { showToast("Me'yoriy sarfda material qatorlari topilmadi", "Xatolik"); return; }
      const newRows = lines.map((ni, idx) => ({
        id: Date.now() + idx,
        name: ni.name ?? ni.no ?? "",
        unit: ni.unit ?? "",
        quantity: String(parseFloat((ni.totalQty ?? "0").replace(",", ".")) * qty),
        spec: "",
        notes: "",
        image: ni.photoRaw ?? ni.photoSemi ?? "",
      }));
      setRows(newRows);
      showToast(`Me'yoriy sarfdan ${newRows.length} ta qator to'ldirildi`, "success");
    } catch {
      showToast("Me'yoriy sarf yuklanmadi", "Xatolik");
    } finally {
      setNormLoading(false);
    }
  };

  useEffect(() => {
    contractService.getAll().then(setContracts);
    departmentService.getAllFull().then(setDepartments);
  }, []);

  const handleClear = () => {
    setDescription("");
    setRows([emptyRow(1), emptyRow(2), emptyRow(3)]);
    setSignerName("");
    setSignerTitle("");
    setSignDate(new Date().toLocaleDateString("ru-RU").replace(/\//g, "."));
    setContractId("");
    setDepartmentId("");
    if (descRef.current) descRef.current.textContent = "";
  };

  const addRow = () => setRows(r => [...r, emptyRow(Date.now())]);
  const removeRow = (id: number) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id: number, field: keyof TableRow, value: string) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const handleImageUpload = (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      updateRow(id, "image", result);
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => window.print();

  const handleSavePdf = async () => {
    if (!docRef.current) return;
    setSaving(true);
    const noPrint = docRef.current.querySelectorAll<HTMLElement>(".no-print");
    noPrint.forEach(el => (el.style.display = "none"));
    const printImages = docRef.current.querySelectorAll<HTMLElement>(".print-image");
    printImages.forEach(el => (el.style.display = "block"));
    const inlineEditables = docRef.current.querySelectorAll<HTMLElement>(".inline-editable");
    inlineEditables.forEach(el => (el.style.borderBottom = "none"));

    // Replace <select> elements with <span> showing selected text (html2pdf doesn't render select values)
    const selects = docRef.current.querySelectorAll<HTMLSelectElement>("select");
    const selectReplacements: { select: HTMLSelectElement; span: HTMLSpanElement }[] = [];
    selects.forEach(sel => {
      const span = document.createElement("span");
      span.textContent = sel.options[sel.selectedIndex]?.text ?? "";
      span.style.cssText = "font-family:Times New Roman,serif;font-size:12px;color:#000;";
      sel.parentNode?.insertBefore(span, sel);
      sel.style.display = "none";
      selectReplacements.push({ select: sel, span });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (await import("html2pdf.js" as any)).default;
    html2pdf()
      .set({
        margin: 0,
        filename: `talabnoma_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, width: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(docRef.current)
      .save()
      .finally(() => {
        noPrint.forEach(el => el.style.removeProperty("display"));
        printImages.forEach(el => el.style.removeProperty("display"));
        inlineEditables.forEach(el => el.style.removeProperty("border-bottom"));
        selectReplacements.forEach(({ select, span }) => {
          select.style.removeProperty("display");
          span.parentNode?.removeChild(span);
        });
        setSaving(false);
      });
  };

  const handleSaveSystem = async () => {
    const filledRows = rows.filter(r => r.name.trim());
    if (!filledRows.length) {
      showToast("Kamida bitta material kiriting", "Xatolik");
      return;
    }
    if (type === RequisitionType.Contract && !contractId) {
      showToast("Shartnomani tanlang", "Xatolik");
      return;
    }
    if (type === RequisitionType.Individual && !departmentId) {
      showToast("Bo'limni tanlang", "Xatolik");
      return;
    }

    setSavingSystem(true);
    try {
      await requisitionService.create({
        type,
        contractId: type === RequisitionType.Contract ? contractId : undefined,
        departmentId: type === RequisitionType.Individual ? departmentId : undefined,
        purpose: description || "Blank talabnoma",
        items: filledRows.map(r => ({
          freeTextName: r.name,
          freeTextUnit: r.unit,
          freeTextSpec: r.spec,
          quantity: Number(r.quantity) || 1,
          notes: r.notes || undefined,
        })),
      });
      showToast("Talabnoma tizimda saqlandi", "success");
      router.push("/requisitions");
    } catch {
      showToast("Xatolik yuz berdi", "Xatolik");
    } finally {
      setSavingSystem(false);
    }
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            padding: 12mm 15mm !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            font-size: 11px !important;
          }
          .print-page table { font-size: 10px !important; }
          .print-page table th { padding: 4px 5px !important; font-size: 10px !important; line-height: 1.3 !important; }
          .print-page table td { padding: 4px 5px !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          input, textarea { border: none !important; background: transparent !important; resize: none !important; overflow: hidden !important; }
          .inline-editable { border: none !important; }
          .add-row-btn { display: none !important; }
          .remove-row-btn { display: none !important; }
          .no-print { display: none !important; }
          .print-image { display: block !important; }
        }
        @page { margin: 0; size: A4 portrait; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .inline-editable[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        marginBottom: 24,
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}>
        {/* Top row: navigation + title */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg3)",
        }}>
          <button
            onClick={() => router.push("/requisitions")}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)", flexShrink: 0, transition: "border-color 0.15s, color 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Orqaga
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>Talabnoma blanki</h1>

          <div style={{ flex: 1 }} />

          {/* Type + contract/dept selectors */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={type}
              onChange={e => setType(Number(e.target.value) as RequisitionType)}
              style={{ padding: "5px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text)", cursor: "pointer" }}
            >
              <option value={RequisitionType.Contract}>Shartnoma bo&apos;yicha</option>
              <option value={RequisitionType.Individual}>Individual</option>
            </select>

            {type === RequisitionType.Contract ? (
              <select
                value={contractId}
                onChange={e => setContractId(e.target.value)}
                style={{ padding: "5px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text)", cursor: "pointer", maxWidth: 220 }}
              >
                <option value="">— Shartnoma —</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNo} — {c.contractParty}</option>)}
              </select>
            ) : (
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                style={{ padding: "5px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text)", cursor: "pointer", maxWidth: 220 }}
              >
                <option value="">— Bo&apos;lim —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}

            {type === RequisitionType.Contract && (
              <button
                type="button"
                disabled={!contractId || normLoading}
                onClick={fillFromNorm}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", background: "#2563eb", color: "#fff", cursor: (!contractId || normLoading) ? "not-allowed" : "pointer", opacity: (!contractId || normLoading) ? 0.45 : 1, whiteSpace: "nowrap", transition: "opacity 0.15s" }}
              >
                {normLoading ? (
                  <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
                Me&apos;yoriy sarfdan to&apos;ldirish
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: action buttons */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
        }}>
          <button
            onClick={handleClear}
            title="Blankni tozalash"
            onMouseEnter={e => { e.currentTarget.style.background = "#fff0f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg3)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", background: "var(--bg3)", border: "1.5px solid #e53e3e", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#e53e3e", transition: "background 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Tozalash
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          <button
            onClick={handleSaveSystem}
            disabled={savingSystem}
            onMouseEnter={e => { if (!savingSystem) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = savingSystem ? "0.7" : "1"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: savingSystem ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: savingSystem ? 0.7 : 1, transition: "opacity 0.15s" }}
          >
            {savingSystem ? (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            Tizimda saqlash
          </button>

          <button
            onClick={handleSavePdf}
            disabled={saving}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; } }}
            onMouseLeave={e => { if (!saving) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; } }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--bg3)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1, transition: "border-color 0.15s, color 0.15s" }}
          >
            {saving ? (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            PDF saqlash
          </button>

          <button
            onClick={handlePrint}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "opacity 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="6,9 6,2 18,2 18,9" />
              <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Chop etish
          </button>
        </div>
      </div>

      {/* Document */}
      <div ref={docRef} className="print-page" style={{
        background: "#fff",
        color: "#000",
        fontFamily: "Times New Roman, serif",
        fontSize: 13,
        padding: "28px 36px",
        boxShadow: "var(--shadow2)",
        borderRadius: 6,
        border: "1px solid var(--border)",
        width: 794,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}>
        {/* Company header */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "Times New Roman, serif" }}>
            &quot;INNOVATSIYA TEXNOLOGIYALARI MARKAZI&quot; MChJ
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 2, fontSize: 13 }}>
          Бош директорига
        </div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, letterSpacing: 1, margin: "12px 0 18px", fontFamily: "Times New Roman, serif" }}>
          ТАЛАБНОМА
        </div>

        {/* Intro text with editable box */}
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>
          Ушбу оркали Сиздан,{" "}
          <span
            ref={descRef}
            className="inline-editable"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="matn kiriting..."
            onInput={e => setDescription(e.currentTarget.textContent || "")}
            style={{
              borderBottom: "1px solid #999",
              minWidth: 120,
              display: "inline-block",
              outline: "none",
              fontFamily: "Times New Roman, serif",
              fontSize: 13,
              color: "#000",
              cursor: "text",
              verticalAlign: "baseline",
            }}
          />{" "}
          омбордан берилиши учун рухсат беришингизни сўрайман.
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col className="no-print" style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#b8860b", color: "#fff" }}>
              <th style={th}>№</th>
              <th style={th}>Махсулот номи<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(рус тилида кўрсатилган)</span></th>
              <th style={th}>Ўлчов<br />бирлиги</th>
              <th style={th}>Миқдори</th>
              <th style={th}>Техник кўрсаткичи<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(рус тилида кўрсатилди)</span></th>
              <th style={th}>Фотосурати</th>
              <th style={th}>Изох</th>
              <th className="no-print" style={{ ...th, background: "#9a6f00" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{i + 1}.</td>
                <td style={td}>
                  <textarea
                    value={row.name}
                    onChange={e => updateRow(row.id, "name", e.target.value)}
                    rows={2}
                    style={cellInput}
                    placeholder="Nomi..."
                  />
                </td>
                <td style={td}>
                  <select
                    value={row.unit}
                    onChange={e => updateRow(row.id, "unit", e.target.value)}
                    style={{ ...cellInput, cursor: "pointer", appearance: "auto" }}
                  >
                    <option value="">—</option>
                    {(Object.values(ProductUnit).filter(v => typeof v === "number") as ProductUnit[]).map(u => (
                      <option key={u} value={PRODUCT_UNIT_LABELS_CYR[u]}>{PRODUCT_UNIT_LABELS_CYR[u]}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <textarea
                    value={row.quantity}
                    onChange={e => updateRow(row.id, "quantity", e.target.value)}
                    rows={2}
                    style={cellInput}
                    placeholder="0"
                  />
                </td>
                <td style={td}>
                  <textarea
                    value={row.spec}
                    onChange={e => updateRow(row.id, "spec", e.target.value)}
                    rows={3}
                    style={cellInput}
                    placeholder="Texnik ko'rsatkich..."
                  />
                </td>
                <td style={{ ...td, textAlign: "center", padding: 6, verticalAlign: "middle" }}>
                  {row.image ? (
                    <>
                      {/* Preview + action buttons */}
                      <div className="no-print" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <img src={row.image} alt="расм" style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain", borderRadius: 3, border: "1px solid #e0c060" }} />
                        <div style={{ display: "flex", gap: 4 }}>
                          <label title="Rasmni almashtirish" style={{
                            display: "inline-flex", alignItems: "center", gap: 2,
                            fontSize: 10, color: "#b8860b", cursor: "pointer",
                            background: "#fffbea", border: "1px solid #d4a900",
                            borderRadius: 3, padding: "2px 6px", fontFamily: "Arial, sans-serif",
                          }}>
                            <input type="file" accept="image/*" style={{ display: "none" }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(row.id, f); }} />
                            ✎
                          </label>
                          <button onClick={() => updateRow(row.id, "image", "")} title="Rasmni o'chirish" style={{
                            display: "inline-flex", alignItems: "center", gap: 2,
                            fontSize: 10, color: "#c00", cursor: "pointer",
                            background: "#fff0f0", border: "1px solid #f99",
                            borderRadius: 3, padding: "2px 6px", fontFamily: "Arial, sans-serif",
                          }}>✕</button>
                        </div>
                      </div>
                      {/* Print-only image */}
                      <img src={row.image} alt="расм" className="print-image" style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain", display: "none" }} />
                    </>
                  ) : (
                    <label className="no-print" title="Rasm yuklash" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 72, border: "1.5px dashed #c9a020", borderRadius: 5, cursor: "pointer", color: "#b8860b", background: "#fffdf0", transition: "background 0.15s" }}>
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(row.id, f); }} />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a020" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span style={{ fontSize: 9, fontFamily: "Arial, sans-serif", color: "#b8860b" }}>Rasm yuklash</span>
                    </label>
                  )}
                </td>
                <td style={td}>
                  <textarea
                    value={row.notes}
                    onChange={e => updateRow(row.id, "notes", e.target.value)}
                    rows={2}
                    style={cellInput}
                    placeholder="..."
                  />
                </td>
                <td className="no-print remove-row-btn" style={{ ...td, textAlign: "center", verticalAlign: "middle" }}>
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#c00", fontSize: 16, padding: 4 }}
                    >✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add row */}
        <div className="no-print add-row-btn" style={{ marginBottom: 24 }}>
          <button
            onClick={addRow}
            style={{ fontSize: 12, fontWeight: 600, color: "#b8860b", background: "none", border: "1px dashed #b8860b", borderRadius: 4, padding: "5px 14px", cursor: "pointer" }}
          >
            + Qator qo&apos;shish
          </button>
        </div>

        {/* Signature */}
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start", marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <textarea
              value={signerTitle}
              onChange={e => setSignerTitle(e.target.value)}
              placeholder="Lavozim (masalan: ТИКУВ ЦЕХИ БОШЛИҒИ)"
              rows={2}
              style={{ ...sigInput, width: "100%", textTransform: "uppercase", fontWeight: 700, fontSize: 12, resize: "none", display: "block", overflow: "hidden", wordBreak: "break-word" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="F.I.O."
              rows={2}
              style={{ ...sigInput, width: "100%", resize: "none", display: "block", overflow: "hidden", wordBreak: "break-word" }}
            />
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ display: "inline-block", borderBottom: "1px solid #999", minWidth: 110, maxWidth: 110, fontSize: 12, fontFamily: "Times New Roman, serif", paddingBottom: 2, paddingLeft: 2 }}>
            {signDate}
          </span>
          <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>йил</span>
          <input
            type="date"
            onChange={e => setSignDate(e.target.value.replace(/-/g, "."))}
            className="no-print"
            style={{ marginLeft: 8, fontSize: 11, border: "1.5px solid var(--border)", borderRadius: 3, padding: "2px 4px", background: "var(--bg3)", color: "var(--text)", cursor: "pointer" }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "5px 6px",
  border: "1px solid #a0720a",
  fontWeight: 700,
  fontSize: 11,
  textAlign: "center",
  lineHeight: 1.3,
};

const td: React.CSSProperties = {
  padding: "5px 7px",
  border: "1px solid #ccc",
  verticalAlign: "top",
  overflow: "hidden",
  wordBreak: "break-word",
};

const cellInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  fontFamily: "Times New Roman, serif",
  fontSize: 12,
  resize: "none",
  outline: "none",
  padding: 0,
  color: "#000",
  boxSizing: "border-box",
  lineHeight: 1.5,
  overflow: "hidden",
  wordBreak: "break-word",
};

const sigInput: React.CSSProperties = {
  border: "none",
  borderBottom: "1px solid #999",
  background: "transparent",
  fontFamily: "Times New Roman, serif",
  fontSize: 13,
  outline: "none",
  padding: "2px 4px",
  color: "#000",
};
