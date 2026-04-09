"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToastStore } from "@/lib/store/toastStore";
import {
  requisitionService,
  contractService,
  departmentService,
  RequisitionType,
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
}

const emptyRow = (id: number): TableRow => ({ id, name: "", unit: "", quantity: "", spec: "", notes: "" });

export default function RequisitionPrintPage() {
  const router = useRouter();
  const docRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    contractService.getAll().then(setContracts);
    departmentService.getAllFull().then(setDepartments);
  }, []);

  const addRow = () => setRows(r => [...r, emptyRow(Date.now())]);
  const removeRow = (id: number) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id: number, field: keyof TableRow, value: string) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const handlePrint = () => window.print();

  const handleSavePdf = async () => {
    if (!docRef.current) return;
    setSaving(true);
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
      .finally(() => setSaving(false));
  };

  const handleSaveSystem = async () => {
    const filledRows = rows.filter(r => r.name.trim());
    if (!filledRows.length) {
      showToast("Kamida bitta material kiriting", "error");
      return;
    }
    if (type === RequisitionType.Contract && !contractId) {
      showToast("Shartnomani tanlang", "error");
      return;
    }
    if (type === RequisitionType.Individual && !departmentId) {
      showToast("Bo'limni tanlang", "error");
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
      showToast("Xatolik yuz berdi", "error");
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
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          input, textarea { border: none !important; background: transparent !important; resize: none !important; overflow: hidden !important; }
          .add-row-btn { display: none !important; }
          .remove-row-btn { display: none !important; }
        }
        @page { margin: 0; size: A4 portrait; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push("/requisitions")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text2)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Orqaga
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text1)", flex: 1 }}>Talabnoma blanki</h1>

        {/* Type + contract/dept selector */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={type}
            onChange={e => setType(Number(e.target.value) as RequisitionType)}
            style={{ padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text1)", cursor: "pointer" }}
          >
            <option value={RequisitionType.Contract}>Shartnoma bo&apos;yicha</option>
            <option value={RequisitionType.Individual}>Individual</option>
          </select>
          {type === RequisitionType.Contract ? (
            <select
              value={contractId}
              onChange={e => setContractId(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text1)", cursor: "pointer", maxWidth: 220 }}
            >
              <option value="">— Shartnoma —</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNo} — {c.contractParty}</option>)}
            </select>
          ) : (
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg2)", color: "var(--text1)", cursor: "pointer", maxWidth: 220 }}
            >
              <option value="">— Bo&apos;lim —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        <button
          onClick={handleSaveSystem}
          disabled={savingSystem}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "var(--success)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: savingSystem ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: savingSystem ? 0.7 : 1 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {savingSystem ? "Saqlanmoqda…" : "Tizimda saqlash"}
        </button>

        <button
          onClick={handleSavePdf}
          disabled={saving}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "var(--bg3)", color: "var(--text1)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {saving ? "Saqlanmoqda…" : "PDF saqlash"}
        </button>

        <button
          onClick={handlePrint}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6,9 6,2 18,2 18,9" />
            <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Chop etish
        </button>
      </div>

      {/* Document */}
      <div ref={docRef} className="print-page" style={{
        background: "#fff",
        color: "#000",
        fontFamily: "Times New Roman, serif",
        fontSize: 13,
        padding: "28px 36px",
        boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
        borderRadius: 6,
        border: "1px solid #ddd",
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
          <div>Ушбу оркали Сиздан,</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Bu yerga matn kiriting..."
            rows={3}
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #999",
              background: "transparent",
              fontFamily: "Times New Roman, serif",
              fontSize: 13,
              lineHeight: 1.8,
              resize: "vertical",
              outline: "none",
              padding: "2px 4px",
              color: "#000",
              boxSizing: "border-box",
            }}
          />
          <div>омбордан берилиши учун рухсат беришингизни сўрайман.</div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col className="no-print" style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#b8860b", color: "#fff" }}>
              <th style={th}>№</th>
              <th style={th}>Махсулот номи<br /><span style={{ fontWeight: 400, fontSize: 11 }}>(рус тилида кўрсатилган)</span></th>
              <th style={th}>Ўлчов<br />бирлиги</th>
              <th style={th}>Миқдори</th>
              <th style={th}>Техник кўрсаткичи<br /><span style={{ fontWeight: 400, fontSize: 11 }}>(рус тилида кўрсатилди)</span></th>
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
                  <textarea
                    value={row.unit}
                    onChange={e => updateRow(row.id, "unit", e.target.value)}
                    rows={2}
                    style={cellInput}
                    placeholder="дона"
                  />
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
                <td style={{ ...td, textAlign: "center", color: "#999", fontSize: 11 }}>[расм]</td>
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
            style={{ marginLeft: 8, fontSize: 11, border: "1px solid #ccc", borderRadius: 3, padding: "2px 4px", background: "#f9f9f9", cursor: "pointer" }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #a0720a",
  fontWeight: 700,
  fontSize: 12,
  textAlign: "center",
  lineHeight: 1.4,
};

const td: React.CSSProperties = {
  padding: "6px 8px",
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
