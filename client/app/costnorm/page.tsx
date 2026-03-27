"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Upload, X, Image, ImageOff, Trash2, Eye } from "lucide-react";
import {
  contractService,
  costNormService,
  type ContractResponse,
  type CostNormResponse,
  type CostNormItemResponse,
} from "@/lib/userService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialRow {
  no: string;
  name: string;
  unit: string;
  readyQty: string;
  wasteQty: string;
  totalQty: string;
  photoRaw: string;
  photoSemi: string;
  importType: string;
  isSection: boolean;
  sectionName: string;
}

interface ParsedTable {
  title: string;
  rows: MaterialRow[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseMainTables(html: string): ParsedTable[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const results: ParsedTable[] = [];
  let idx = 0;

  for (const table of tables) {
    const thead = table.querySelector("thead");
    if (!thead) continue;
    const theadText = thead.textContent || "";
    if (!theadText.includes("лчов")) continue;

    idx++;
    const rows: MaterialRow[] = [];
    const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));

    for (const tr of tbodyRows) {
      const cells = Array.from(tr.querySelectorAll("td, th"));

      const hasColspan = cells.some(
        (td) => parseInt(td.getAttribute("colspan") || "1") >= 5
      );
      if (hasColspan) {
        const text = tr.textContent?.trim() || "";
        if (text) rows.push({ isSection: true, sectionName: text, no: "", name: "", unit: "", readyQty: "", wasteQty: "", totalQty: "", photoRaw: "", photoSemi: "", importType: "" });
        continue;
      }
      if (cells.length < 3) continue;

      const getText = (cell: Element) => cell.textContent?.trim() || "";
      const getPhoto = (cell: Element) => cell.querySelector("img")?.getAttribute("src") || "";

      const name = getText(cells[1] ?? cells[0]);
      if (!name) continue;

      rows.push({
        isSection: false,
        sectionName: "",
        no: getText(cells[0]),
        name,
        unit: getText(cells[2]),
        readyQty: getText(cells[3]),
        wasteQty: getText(cells[4]),
        totalQty: getText(cells[5]),
        photoRaw: cells[6] ? getPhoto(cells[6]) : "",
        photoSemi: cells[7] ? getPhoto(cells[7]) : "",
        importType: cells[8] ? getText(cells[8]) : "",
      });
    }

    if (rows.length > 0) results.push({ title: `Jadval ${idx}`, rows });
  }

  return results;
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────

function PhotoCell({ src }: { src: string | null }) {
  const [open, setOpen] = useState(false);
  if (!src) return <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>;
  return (
    <>
      <img
        src={src}
        alt="foto"
        onClick={() => setOpen(true)}
        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid var(--border)" }}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <img src={src} alt="foto" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </>
  );
}

// ─── Items Table ──────────────────────────────────────────────────────────────

function ItemsTable({ rows, showPhotos }: { rows: (MaterialRow | CostNormItemResponse)[], showPhotos: boolean }) {
  let rowIndex = 0;

  const normalizedRows = rows.map(r => {
    if ("isSection" in r && typeof (r as MaterialRow).no === "string") {
      const mr = r as MaterialRow;
      return { isSection: mr.isSection, sectionName: mr.sectionName || mr.name, no: mr.no, name: mr.name, unit: mr.unit, readyQty: mr.readyQty, wasteQty: mr.wasteQty, totalQty: mr.totalQty, photoRaw: mr.photoRaw || null, photoSemi: mr.photoSemi || null, importType: mr.importType };
    }
    const ir = r as CostNormItemResponse;
    return { isSection: ir.isSection, sectionName: ir.sectionName, no: ir.no, name: ir.name, unit: ir.unit, readyQty: ir.readyQty, wasteQty: ir.wasteQty, totalQty: ir.totalQty, photoRaw: ir.photoRaw, photoSemi: ir.photoSemi, importType: ir.importType };
  });

  return (
    <table className="itm-table">
      <thead>
        <tr>
          <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
          <th style={{ color: "var(--text1)", minWidth: 200 }}>Материал номи</th>
          <th style={{ color: "var(--text1)", width: 70 }}>Ўлчов</th>
          <th style={{ textAlign: "right", color: "var(--text1)", width: 110 }}>Тайёр маҳсулот</th>
          <th style={{ textAlign: "right", color: "var(--text1)", width: 90 }}>Чиқинди</th>
          <th style={{ textAlign: "right", color: "var(--text1)", width: 90 }}>Умумий сарф</th>
          {showPhotos && (
            <>
              <th style={{ color: "var(--text1)", width: 70 }}>Хом-ашё</th>
              <th style={{ color: "var(--text1)", width: 70 }}>Ярим тайёр</th>
            </>
          )}
          <th style={{ color: "var(--text1)", width: 120 }}>Манба</th>
        </tr>
      </thead>
      <tbody>
        {normalizedRows.map((row, i) => {
          if (row.isSection) {
            return (
              <tr key={i}>
                <td
                  colSpan={showPhotos ? 9 : 7}
                  style={{ padding: "8px 14px", background: "var(--bg2)", fontWeight: 700, fontSize: 12, color: "var(--text2)", borderTop: "2px solid var(--border)", letterSpacing: 0.3 }}
                >
                  {row.sectionName}
                </td>
              </tr>
            );
          }

          rowIndex++;
          return (
            <tr key={i}>
              <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px", color: "var(--text3)", fontSize: 12 }}>
                {String(rowIndex).padStart(2, "0")}
              </td>
              <td style={{ color: "var(--text1)", lineHeight: 1.4 }}>{row.name || "—"}</td>
              <td style={{ color: "var(--text2)" }}>{row.unit || "—"}</td>
              <td style={{ textAlign: "right", color: "var(--text2)", fontFamily: "var(--font-mono)" }}>{row.readyQty || "—"}</td>
              <td style={{ textAlign: "right", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{row.wasteQty || "—"}</td>
              <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text1)", fontFamily: "var(--font-mono)" }}>{row.totalQty || "—"}</td>
              {showPhotos && (
                <>
                  <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoRaw} /></td>
                  <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoSemi} /></td>
                </>
              )}
              <td>
                {row.importType ? (
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#e6f4ea" : "#e8f0fe",
                    color: row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#1e7e34" : "#1a56db",
                    border: `1px solid ${row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#a8d5b5" : "#a4c0f4"}`,
                  }}>
                    {row.importType}
                  </span>
                ) : "—"}
              </td>
            </tr>
          );
        })}
        {normalizedRows.filter(r => !r.isSection).length === 0 && (
          <tr>
            <td colSpan={showPhotos ? 9 : 7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
              Ma&apos;lumot topilmadi
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = "list" | "create" | "detail";

export default function CostNormPage() {
  const [mode, setMode] = useState<Mode>("list");
  const [showPhotos, setShowPhotos] = useState(false);
  const [search, setSearch] = useState("");

  // List state
  const [costNorms, setCostNorms] = useState<CostNormResponse[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Detail state
  const [selectedNorm, setSelectedNorm] = useState<CostNormResponse | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Create form state
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [form, setForm] = useState({ contractId: "", title: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Docx parsing (used in create form for preview)
  const [formFile, setFormFile] = useState<File | null>(null);
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const formFileRef = useRef<HTMLInputElement>(null);

  // ── Load list ─────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setListLoading(true);
    const data = await costNormService.getAll();
    setCostNorms(data);
    setListLoading(false);
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Docx parsing ─────────────────────────────────────────────────────────

  async function handleFormFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setParseError("Faqat .docx formatidagi fayllar qo'llab-quvvatlanadi");
      return;
    }
    setFormFile(file);
    setParseError(null);
    setParsedTables([]);
    setParseLoading(true);
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const parsed = parseMainTables(result.value);
      if (parsed.length === 0) {
        setParseError("Faylda mos jadval topilmadi.");
      } else {
        setParsedTables(parsed);
        if (!form.title) {
          setForm(f => ({ ...f, title: file.name.replace(/\.docx$/i, "") }));
        }
      }
    } catch {
      setParseError("Faylni o'qishda xatolik yuz berdi");
    } finally {
      setParseLoading(false);
    }
  }

  // ── Open create ───────────────────────────────────────────────────────────

  async function openCreate() {
    setForm({ contractId: "", title: "", notes: "" });
    setFormFile(null);
    setParsedTables([]);
    setParseError(null);
    setSaveError(null);
    setSubmitted(false);
    setActiveTab(0);
    setMode("create");
    setContractsLoading(true);
    try {
      const list = await contractService.getAll();
      setContracts(list);
    } catch {
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSubmitted(true);
    if (!form.contractId || parsedTables.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const allRows = parsedTables.flatMap(t => t.rows);
      const items = allRows.map((row, idx) => ({
        isSection: row.isSection,
        sectionName: row.isSection ? row.sectionName : null,
        no: row.no || null,
        name: row.name || null,
        unit: row.unit || null,
        readyQty: row.readyQty || null,
        wasteQty: row.wasteQty || null,
        totalQty: row.totalQty || null,
        photoRaw: row.photoRaw || null,
        photoSemi: row.photoSemi || null,
        importType: row.importType || null,
        sortOrder: idx,
      }));

      await costNormService.create({
        contractId: form.contractId,
        title: form.title || formFile?.name?.replace(/\.docx$/i, "") || "Me'yoriy sarf",
        notes: form.notes || null,
        items,
      });

      await loadList();
      setMode("list");
    } catch {
      setSaveError("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Bu yozuvni o'chirmoqchimisiz?")) return;
    await costNormService.delete(id);
    await loadList();
  }

  // ── Open detail ───────────────────────────────────────────────────────────

  function openDetail(norm: CostNormResponse) {
    setSelectedNorm(norm);
    setActiveTab(0);
    setSearch("");
    setShowPhotos(false);
    setMode("detail");
  }

  // ── Detail: split items into tables by section boundaries ─────────────────

  const detailTables = useMemo(() => {
    if (!selectedNorm) return [];
    const sorted = [...selectedNorm.items].sort((a, b) => a.sortOrder - b.sortOrder);
    // Group by... all items together (backend stores all tables flat with SortOrder)
    return [{ title: selectedNorm.title, rows: sorted }];
  }, [selectedNorm]);

  const detailRows = detailTables[activeTab]?.rows ?? [];

  const filteredDetail = useMemo(() => {
    if (!search.trim()) return detailRows;
    const q = search.toLowerCase();
    let currentSection = "";
    const result: CostNormItemResponse[] = [];
    for (const row of detailRows) {
      if (row.isSection) { currentSection = row.sectionName || ""; continue; }
      if (
        (row.name ?? "").toLowerCase().includes(q) ||
        (row.unit ?? "").toLowerCase().includes(q) ||
        (row.importType ?? "").toLowerCase().includes(q)
      ) {
        if (result.length === 0 || result[result.length - 1].sectionName !== currentSection) {
          result.push({ id: "", isSection: true, sectionName: currentSection, no: null, name: null, unit: null, readyQty: null, wasteQty: null, totalQty: null, photoRaw: null, photoSemi: null, importType: null, sortOrder: -1 });
        }
        result.push(row);
      }
    }
    return result;
  }, [detailRows, search]);

  // ── List search ───────────────────────────────────────────────────────────

  const filteredList = useMemo(() => {
    if (!search.trim()) return costNorms;
    const q = search.toLowerCase();
    return costNorms.filter(n =>
      n.contractNo.toLowerCase().includes(q) ||
      n.clientName.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q)
    );
  }, [costNorms, search]);

  // ── Render: Create ────────────────────────────────────────────────────────

  if (mode === "create") {
    const currentRows = parsedTables[activeTab]?.rows ?? [];
    const dataCount = currentRows.filter(r => !r.isSection).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>Yangi me&apos;yoriy sarf yozuvi</span>
        </div>

        <div className="itm-card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Shartnoma */}
            <div style={{ gridColumn: "1 / 3" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && !form.contractId ? "var(--danger)" : "var(--text2)" }}>
                Shartnoma <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="form-input"
                value={form.contractId}
                onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
                style={{ cursor: "pointer", ...(submitted && !form.contractId ? { borderColor: "var(--danger)" } : {}) }}
                disabled={contractsLoading}
              >
                <option value="">{contractsLoading ? "Yuklanmoqda..." : "Shartnoma tanlang"}</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.contractNo}{c.clientName ? ` — ${c.clientName}` : ""}
                  </option>
                ))}
              </select>
              {submitted && !form.contractId && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Shartnoma tanlash shart</div>
              )}
            </div>

            {/* Sarlavha */}
            <div style={{ gridColumn: "1 / 3" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                Sarlavha
              </label>
              <input
                className="form-input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Avtomatik to'ldiriladi"
              />
            </div>

            {/* Fayl yuklash */}
            <div style={{ gridColumn: "1 / 3" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--text2)" }}>
                Word fayl (.docx) <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input ref={formFileRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleFormFileChange} />
              {formFile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#2563eb)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 13, color: "var(--text1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formFile.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>{(formFile.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => { setFormFile(null); setParsedTables([]); if (formFileRef.current) formFileRef.current.value = ""; }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text3)", display: "flex" }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => formFileRef.current?.click()}
                  style={{ width: "100%", padding: "14px 0", borderRadius: "var(--radius)", border: `1.5px dashed ${submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--border)"}`, background: "var(--bg2)", cursor: "pointer", color: submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--text2)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Upload size={15} />
                  Fayl tanlang yoki bu yerga tashlang
                </button>
              )}
              {submitted && parsedTables.length === 0 && !parseLoading && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Fayl yuklash va jadval topilishi shart</div>
              )}
            </div>
          </div>
        </div>

        {/* Parse xatolik */}
        {parseError && (
          <div style={{ padding: "10px 16px", borderRadius: 8, background: "var(--danger-dim,#fee2e2)", color: "var(--danger,#dc2626)", fontSize: 13, border: "1px solid var(--danger,#fca5a5)" }}>
            {parseError}
          </div>
        )}

        {/* Parse loading */}
        {parseLoading && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Fayl o&apos;qilmoqda...</div>
        )}

        {/* Preview */}
        {parsedTables.length > 0 && (
          <div className="itm-card" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Ko&apos;rinish</span>
              <span style={{ fontSize: 12, color: "var(--text3)", marginRight: "auto" }}>
                {parsedTables.length} ta jadval · {dataCount} ta yozuv
              </span>
              {parsedTables.length > 1 && (
                <select className="form-input" value={activeTab} onChange={e => setActiveTab(Number(e.target.value))} style={{ width: 140, cursor: "pointer", height: 32, padding: "0 8px", fontSize: 12 }}>
                  {parsedTables.map((t, i) => (
                    <option key={i} value={i}>{t.title} ({t.rows.filter(r => !r.isSection).length})</option>
                  ))}
                </select>
              )}
              <button onClick={() => setShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", height: 32, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: showPhotos ? "var(--accent-dim,#e8f0fe)" : "var(--bg2)", color: showPhotos ? "var(--accent,#1a56db)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                {showPhotos ? <Image size={12} /> : <ImageOff size={12} />}
                {showPhotos ? "Yashirish" : "Fotolar"}
              </button>
            </div>
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 520px)" }}>
              <ItemsTable rows={currentRows} showPhotos={showPhotos} />
            </div>
          </div>
        )}

        {saveError && (
          <div style={{ padding: "10px 16px", borderRadius: 8, background: "var(--danger-dim,#fee2e2)", color: "var(--danger,#dc2626)", fontSize: 13, border: "1px solid var(--danger,#fca5a5)" }}>
            {saveError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
          <button onClick={() => setMode("list")} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "10px 24px", color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 32px", borderRadius: "var(--radius)" }}>
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

  // ── Render: Detail ────────────────────────────────────────────────────────

  if (mode === "detail" && selectedNorm) {
    const dataCount = filteredDetail.filter(r => !r.isSection).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
          <button onClick={() => { setMode("list"); setSelectedNorm(null); setSearch(""); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            ← Orqaga
          </button>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedNorm.title}
            </span>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {selectedNorm.contractNo} — {selectedNorm.clientName} · {new Date(selectedNorm.createdAt).toLocaleDateString("uz-UZ")}
            </span>
          </div>

          <div className="search-wrap" style={{ maxWidth: 240, minWidth: 160 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="search-input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>{dataCount} ta yozuv</span>

          <button onClick={() => setShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: showPhotos ? "var(--accent-dim,#e8f0fe)" : "var(--bg2)", color: showPhotos ? "var(--accent,#1a56db)" : "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            {showPhotos ? <Image size={13} /> : <ImageOff size={13} />}
            {showPhotos ? "Yashirish" : "Fotolar"}
          </button>
        </div>

        <div className="itm-card" style={{ flex: 1 }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
            <ItemsTable rows={filteredDetail} showPhotos={showPhotos} />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ maxWidth: "none", flex: 1, minWidth: 180 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="search-input" placeholder="Qidirish: shartnoma, mijoz, sarlavha..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button
          onClick={openCreate}
          className="btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 18px", height: 36, fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", border: "none", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yaratish
        </button>
      </div>

      <div className="itm-card" style={{ flex: 1 }}>
        {listLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Yuklanmoqda...</div>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text3)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Upload size={32} color="var(--text3)" />
            <div>{search ? "Natija topilmadi" : "Hali me'yoriy sarf yozuvlari yo'q"}</div>
            {!search && <div style={{ fontSize: 12 }}>Yangi yozuv qo&apos;shish uchun <strong>Yaratish</strong> tugmasini bosing</div>}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="itm-table">
              <thead>
                <tr>
                  <th style={{ width: 48, textAlign: "center", textTransform: "none" }}>T/r</th>
                  <th>Shartnoma</th>
                  <th>Mijoz</th>
                  <th>Sarlavha</th>
                  <th style={{ width: 80, textAlign: "center" }}>Yozuvlar</th>
                  <th style={{ width: 110 }}>Sana</th>
                  <th style={{ width: 90, textAlign: "center" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((norm, i) => {
                  const dataItems = norm.items.filter(it => !it.isSection).length;
                  return (
                    <tr key={norm.id} style={{ cursor: "pointer" }} onClick={() => openDetail(norm)}>
                      <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--accent,#2563eb)" }}>{norm.contractNo}</td>
                      <td style={{ color: "var(--text2)" }}>{norm.clientName || "—"}</td>
                      <td style={{ color: "var(--text1)" }}>{norm.title}</td>
                      <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{dataItems}</td>
                      <td style={{ color: "var(--text3)", fontSize: 12 }}>
                        {new Date(norm.createdAt).toLocaleDateString("uz-UZ")}
                      </td>
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => openDetail(norm)}
                            title="Ko'rish"
                            style={{ padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", cursor: "pointer", color: "var(--text2)", display: "flex", alignItems: "center" }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(norm.id)}
                            title="O'chirish"
                            style={{ padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--danger,#fca5a5)", background: "var(--danger-dim,#fee2e2)", cursor: "pointer", color: "var(--danger,#dc2626)", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
