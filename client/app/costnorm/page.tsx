"use client";

import { useRef, useState, useMemo } from "react";
import { Upload, FileText, X, Search, Image, ImageOff, ChevronDown, ChevronRight } from "lucide-react";

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
    if (!theadText.includes("лчов")) continue; // Ўлчов бирлиги

    idx++;
    const rows: MaterialRow[] = [];
    const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));

    for (const tr of tbodyRows) {
      const cells = Array.from(tr.querySelectorAll("td, th"));

      // Section header row (has a cell with large colspan)
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

function PhotoCell({ src }: { src: string }) {
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

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({ rows, showPhotos }: { rows: MaterialRow[]; showPhotos: boolean }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (s: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });

  // Group rows by section for filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    let currentSection = "";
    const result: MaterialRow[] = [];

    for (const row of rows) {
      if (row.isSection) {
        currentSection = row.sectionName;
        continue;
      }
      if (
        row.name.toLowerCase().includes(q) ||
        row.unit.toLowerCase().includes(q) ||
        row.importType.toLowerCase().includes(q)
      ) {
        // add section header if not already added
        if (result.length === 0 || result[result.length - 1].sectionName !== currentSection) {
          result.push({ isSection: true, sectionName: currentSection, no: "", name: "", unit: "", readyQty: "", wasteQty: "", totalQty: "", photoRaw: "", photoSemi: "", importType: "" });
        }
        result.push(row);
      }
    }
    return result;
  }, [rows, search]);

  const dataCount = filtered.filter((r) => !r.isSection).length;
  let currentSection = "";
  let rowIndex = 0;

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontWeight: 600,
    color: "var(--text3)",
    fontSize: 11,
    background: "var(--bg2)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Материал номи bo'yicha qidirish..."
            style={{
              width: "100%", padding: "7px 12px 7px 32px",
              border: "1px solid var(--border)", borderRadius: 7,
              background: "var(--bg1)", color: "var(--text1)", fontSize: 13,
              outline: "none", boxSizing: "border-box",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text3)" }}>
              <X size={13} />
            </button>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>
          {dataCount} ta yozuv
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "65vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 36 }}>#</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Материал номи</th>
              <th style={{ ...thStyle, width: 70 }}>Ўлчов</th>
              <th style={{ ...thStyle, width: 90, textAlign: "right" }}>Тайёр маҳсулот</th>
              <th style={{ ...thStyle, width: 90, textAlign: "right" }}>Чиқинди</th>
              <th style={{ ...thStyle, width: 90, textAlign: "right", color: "var(--text1)" }}>Умумий сарф</th>
              {showPhotos && (
                <>
                  <th style={{ ...thStyle, width: 60 }}>Хом-ашё</th>
                  <th style={{ ...thStyle, width: 60 }}>Ярим тайёр</th>
                </>
              )}
              <th style={{ ...thStyle, width: 110 }}>Манба</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              if (row.isSection) {
                currentSection = row.sectionName;
                const isCollapsed = collapsed.has(row.sectionName);
                return (
                  <tr key={i}>
                    <td
                      colSpan={showPhotos ? 9 : 7}
                      onClick={() => toggle(row.sectionName)}
                      style={{
                        padding: "8px 12px",
                        background: "var(--bg2)",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "var(--text2)",
                        borderTop: "2px solid var(--border)",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        userSelect: "none",
                        letterSpacing: 0.3,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        {row.sectionName}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (collapsed.has(currentSection)) return null;
              rowIndex++;
              const even = rowIndex % 2 === 0;

              return (
                <tr
                  key={i}
                  style={{ background: even ? "var(--bg2)" : undefined, borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg3, #f0f4ff)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = even ? "var(--bg2)" : ""; }}
                >
                  <td style={{ padding: "8px 12px", color: "var(--text3)", fontSize: 12 }}>{rowIndex}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text1)", lineHeight: 1.4 }}>{row.name}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text2)" }}>{row.unit || "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>{row.readyQty || "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{row.wasteQty || "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text1)", fontVariantNumeric: "tabular-nums" }}>{row.totalQty || "—"}</td>
                  {showPhotos && (
                    <>
                      <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoRaw} /></td>
                      <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoSemi} /></td>
                    </>
                  )}
                  <td style={{ padding: "8px 12px" }}>
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
          </tbody>
        </table>
        {dataCount === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 14 }}>
            Hech narsa topilmadi
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostNormPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [tables, setTables] = useState<ParsedTable[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [showPhotos, setShowPhotos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function parseDocx(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Faqat .docx formatidagi fayllar qo'llab-quvvatlanadi");
      return;
    }
    setLoading(true);
    setError(null);
    setFileName(file.name);
    setTables([]);
    setActiveTab(0);

    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const parsed = parseMainTables(result.value);

      if (parsed.length === 0) {
        setError("Faylda mos jadval topilmadi.");
      } else {
        setTables(parsed);
      }
    } catch (err) {
      console.error(err);
      setError("Faylni o'qishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseDocx(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseDocx(file);
  }

  function handleClear() {
    setFileName(null);
    setTables([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      <div className="page-header">
        <div className="ph-title">Me&apos;yoriy Sarf</div>
        <span className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
          Tex protsess asosidagi sarf me&apos;yorlari
        </span>
      </div>

      {/* Upload card */}
      <div className="itm-card">
        <div className="itm-card-header">
          <span className="itm-card-title">Word fayl yuklash</span>
          <div style={{ display: "flex", gap: 8 }}>
            {tables.length > 0 && (
              <button
                onClick={() => setShowPhotos((p) => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: showPhotos ? "var(--accent-dim, #e8f0fe)" : "var(--bg2)",
                  color: showPhotos ? "var(--accent, #1a56db)" : "var(--text2)",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {showPhotos ? <Image size={13} /> : <ImageOff size={13} />}
                {showPhotos ? "Fotolar yashirish" : "Fotolar ko'rsatish"}
              </button>
            )}
            {fileName && (
              <button
                onClick={handleClear}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)", color: "var(--text2)",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                <X size={13} /> Tozalash
              </button>
            )}
          </div>
        </div>
        <div className="itm-card-body" style={{ paddingBottom: fileName ? 8 : undefined }}>
          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              style={{
                border: `2px dashed ${dragging ? "var(--accent, #2563eb)" : "var(--border)"}`,
                borderRadius: 10, padding: "40px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                cursor: "pointer",
                background: dragging ? "var(--accent-dim, #eff6ff)" : "var(--bg2)",
                transition: "all 0.15s",
              }}
            >
              <Upload size={30} color="var(--text3)" />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>
                Word faylni shu yerga tashlang yoki bosing
              </div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>Faqat .docx format</div>
              <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileChange} style={{ display: "none" }} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
              <FileText size={17} color="var(--accent, #2563eb)" />
              <span style={{ fontSize: 14, color: "var(--text1)", fontWeight: 500 }}>{fileName}</span>
              {loading && <span style={{ fontSize: 13, color: "var(--text3)", marginLeft: "auto" }}>O&apos;qilmoqda...</span>}
              {!loading && tables.length > 0 && (
                <span style={{ fontSize: 13, color: "var(--text3)", marginLeft: "auto" }}>
                  {tables.length} ta jadval • {tables.reduce((s, t) => s + t.rows.filter(r => !r.isSection).length, 0)} ta yozuv
                </span>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 10, padding: "9px 14px", borderRadius: 8, background: "var(--danger-dim, #fee2e2)", color: "var(--danger, #dc2626)", fontSize: 13, border: "1px solid var(--danger, #fca5a5)" }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Data card */}
      {tables.length > 0 && (
        <div className="itm-card">
          <div className="itm-card-header" style={{ paddingBottom: 0, borderBottom: "none" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {tables.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  style={{
                    padding: "6px 16px", borderRadius: "6px 6px 0 0",
                    border: "1px solid var(--border)",
                    borderBottom: activeTab === i ? "1px solid var(--bg1, white)" : undefined,
                    background: activeTab === i ? "var(--bg1, white)" : "var(--bg2)",
                    color: activeTab === i ? "var(--text1)" : "var(--text2)",
                    fontWeight: activeTab === i ? 600 : 400,
                    fontSize: 13, cursor: "pointer",
                    marginBottom: activeTab === i ? -1 : 0,
                    position: "relative", zIndex: activeTab === i ? 1 : 0,
                  }}
                >
                  {t.title}
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text3)" }}>
                    ({t.rows.filter(r => !r.isSection).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <TableView key={activeTab} rows={tables[activeTab].rows} showPhotos={showPhotos} />
          </div>
        </div>
      )}
    </>
  );
}
