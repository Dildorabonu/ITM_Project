"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useDraft } from "@/lib/useDraft";
import { Upload, X, Image, ImageOff, Trash2, Eye, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import {
  contractService,
  costNormService,
  DrawingStatus,
  DRAWING_STATUS_LABELS,
  type ContractResponse,
  type CostNormResponse,
  type CostNormItemResponse,
  type AttachmentResponse,
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

// ─── Column validation ────────────────────────────────────────────────────────

type ColField = "no" | "name" | "unit" | "readyQty" | "wasteQty" | "totalQty" | "photoRaw" | "photoSemi" | "importType";

const REQUIRED_COLS: { field: ColField; label: string; test: (t: string) => boolean }[] = [
  { field: "no",         label: "№ т/р",                           test: t => t.includes("№") },
  { field: "name",       label: "Ҳом-ашё номи",                    test: t => t.includes("номи") },
  { field: "unit",       label: "Ўлчов бирлиги",                   test: t => t.includes("лчов") },
  { field: "readyQty",   label: "Тайёр маҳсулот",                  test: t => t.includes("тайёр") && !t.includes("ярим") },
  { field: "wasteQty",   label: "Ҳом-ашё чиқиндиси",              test: t => t.includes("иқинди") },
  { field: "totalQty",   label: "Умумий ҳом-ашё сарфи",            test: t => t.includes("мумий") },
  { field: "importType", label: "Импорт / Местный / Локализация",   test: t => t.includes("импорт") },
];

const OPTIONAL_COLS: { field: ColField; test: (t: string) => boolean }[] = [
  { field: "photoRaw",  test: t => t.includes("хом") && !t.includes("иқинди") && !t.includes("номи") },
  { field: "photoSemi", test: t => t.includes("ярим") },
];

function buildColMap(thead: Element): { colMap: Partial<Record<ColField, number>>; error: string | null } {
  const rows = Array.from(thead.querySelectorAll("tr"));
  if (rows.length === 0) return { colMap: {}, error: "Header qatori topilmadi" };

  const MAX_COLS = 12;
  const grid: (string | null)[][] = Array.from({ length: rows.length }, () => Array(MAX_COLS).fill(null));

  for (let ri = 0; ri < rows.length; ri++) {
    const cells = Array.from(rows[ri].querySelectorAll("td, th"));
    let ci = 0;
    for (const cell of cells) {
      while (ci < MAX_COLS && grid[ri][ci] !== null) ci++;
      if (ci >= MAX_COLS) break;
      const colspan = Math.max(1, parseInt(cell.getAttribute("colspan") || "1"));
      const rowspan = Math.max(1, parseInt(cell.getAttribute("rowspan") || "1"));
      const text = (cell.textContent?.trim() || "").toLowerCase();
      for (let r = ri; r < Math.min(ri + rowspan, rows.length); r++)
        for (let c = ci; c < Math.min(ci + colspan, MAX_COLS); c++)
          if (grid[r][c] === null) grid[r][c] = text;
      ci += colspan;
    }
  }

  const lastRow = grid[rows.length - 1];
  const colMap: Partial<Record<ColField, number>> = {};
  const missing: string[] = [];

  for (const { field, label, test } of REQUIRED_COLS) {
    const idx = lastRow.findIndex(t => t !== null && test(t));
    if (idx === -1) missing.push(label);
    else colMap[field] = idx;
  }

  if (missing.length > 0)
    return { colMap, error: `Fayl shablonga mos emas. Quyidagi ustunlar topilmadi: ${missing.join(", ")}` };

  for (const { field, test } of OPTIONAL_COLS) {
    const idx = lastRow.findIndex(t => t !== null && test(t));
    if (idx !== -1) colMap[field] = idx;
  }

  return { colMap, error: null };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseMainTables(html: string): { tables: ParsedTable[]; error: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const results: ParsedTable[] = [];
  let idx = 0;

  for (const table of tables) {
    const thead = table.querySelector("thead");
    if (!thead) continue;
    if (!(thead.textContent || "").includes("лчов")) continue;

    const { colMap, error } = buildColMap(thead);
    if (error) return { tables: [], error };

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

      const getText = (idx: number) => cells[idx]?.textContent?.trim() || "";
      const getPhoto = (idx: number) => cells[idx]?.querySelector("img")?.getAttribute("src") || "";

      const name = colMap.name !== undefined ? getText(colMap.name) : "";
      if (!name) continue;

      rows.push({
        isSection: false,
        sectionName: "",
        no:         colMap.no         !== undefined ? getText(colMap.no)         : "",
        name,
        unit:       colMap.unit       !== undefined ? getText(colMap.unit)       : "",
        readyQty:   colMap.readyQty   !== undefined ? getText(colMap.readyQty)   : "",
        wasteQty:   colMap.wasteQty   !== undefined ? getText(colMap.wasteQty)   : "",
        totalQty:   colMap.totalQty   !== undefined ? getText(colMap.totalQty)   : "",
        photoRaw:   colMap.photoRaw   !== undefined ? getPhoto(colMap.photoRaw)  : "",
        photoSemi:  colMap.photoSemi  !== undefined ? getPhoto(colMap.photoSemi) : "",
        importType: colMap.importType !== undefined ? getText(colMap.importType) : "",
      });
    }

    if (rows.length > 0) results.push({ title: `Jadval ${idx}`, rows });
  }

  return { tables: results, error: null };
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

// ─── Collapsible Items Table (detail + create preview) ───────────────────────

type NormRow = {
  isSection: boolean;
  sectionName: string | null;
  name: string | null;
  unit: string | null;
  readyQty: string | null;
  wasteQty: string | null;
  totalQty: string | null;
  photoRaw: string | null;
  photoSemi: string | null;
  importType: string | null;
};

function normalizeRow(r: MaterialRow | CostNormItemResponse): NormRow {
  if ("no" in r && typeof (r as MaterialRow).no === "string" && !("sortOrder" in r)) {
    const mr = r as MaterialRow;
    return { isSection: mr.isSection, sectionName: mr.sectionName || mr.name || null, name: mr.name || null, unit: mr.unit || null, readyQty: mr.readyQty || null, wasteQty: mr.wasteQty || null, totalQty: mr.totalQty || null, photoRaw: mr.photoRaw || null, photoSemi: mr.photoSemi || null, importType: mr.importType || null };
  }
  const ir = r as CostNormItemResponse;
  return { isSection: ir.isSection, sectionName: ir.sectionName, name: ir.name, unit: ir.unit, readyQty: ir.readyQty, wasteQty: ir.wasteQty, totalQty: ir.totalQty, photoRaw: ir.photoRaw, photoSemi: ir.photoSemi, importType: ir.importType };
}

function CollapsibleItemsTable({ rows, showPhotos, onUpdateRow, onDeleteRow }: { rows: (MaterialRow | CostNormItemResponse)[]; showPhotos: boolean; onUpdateRow?: (flatIndex: number, updated: Partial<MaterialRow>) => void; onDeleteRow?: (flatIndex: number) => void }) {
  const editable = !!onUpdateRow;
  const normalized = useMemo(() => rows.map(normalizeRow), [rows]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<NormRow>>({});

  // Group rows into sections (with original flat index for editing)
  const sections = useMemo(() => {
    const groups: { sectionIdx: number; sectionName: string; items: { row: NormRow; flatIdx: number }[] }[] = [];
    let current: { sectionIdx: number; sectionName: string; items: { row: NormRow; flatIdx: number }[] } = {
      sectionIdx: 0,
      sectionName: "",
      items: [],
    };
    let sectionIdx = 0;
    for (let fi = 0; fi < normalized.length; fi++) {
      const row = normalized[fi];
      if (row.isSection) {
        if (current.items.length > 0 || current.sectionName) groups.push(current);
        sectionIdx++;
        current = { sectionIdx, sectionName: row.sectionName || "", items: [] };
      } else {
        current.items.push({ row, flatIdx: fi });
      }
    }
    groups.push(current);
    return groups;
  }, [normalized]);

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleSection = (idx: number) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(sections.map(s => s.sectionIdx)));
  const expandAll = () => setCollapsed(new Set());
  const allCollapsed = collapsed.size === sections.filter(s => s.sectionName).length;

  const colCount = (showPhotos ? 9 : 7) + (editable ? 1 : 0);
  let globalRowIdx = 0;

  return (
    <div>
      {/* Collapse / Expand toolbar */}
      {sections.some(s => s.sectionName) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "6px 14px", borderBottom: "1px solid var(--border)", gap: 6 }}>
          <button
            onClick={allCollapsed ? expandAll : collapseAll}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 11, cursor: "pointer" }}
          >
            {allCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
            {allCollapsed ? "Barchani ochish" : "Barchani yig'ish"}
          </button>
        </div>
      )}

      <table className="itm-table" style={{ width: "100%", tableLayout: "auto" }}>
        <thead>
          <tr>
            <th style={{ width: 42, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>T/r</th>
            <th style={{ color: "var(--text1)", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Материал номи</th>
            <th style={{ color: "var(--text1)", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Ўлчов</th>
            <th style={{ textAlign: "center", color: "var(--text1)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Тайёр маҳсулот</th>
            <th style={{ textAlign: "center", color: "var(--text1)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Чиқинди</th>
            <th style={{ textAlign: "center", color: "var(--text1)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Умумий сарф</th>
            {showPhotos && (
              <>
                <th style={{ color: "var(--text1)", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Хом-ашё</th>
                <th style={{ color: "var(--text1)", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Ярим тайёр</th>
              </>
            )}
            <th style={{ color: "var(--text1)", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Манба</th>
            {editable && <th style={{ whiteSpace: "nowrap", textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)", position: "sticky", top: 0, zIndex: 2, background: "var(--bg2)" }}>Amal</th>}
          </tr>
        </thead>
        <tbody>
          {sections.map(section => {
            const isCollapsed = collapsed.has(section.sectionIdx);
            const hasSection = !!section.sectionName;
            return (
              <React.Fragment key={`section-${section.sectionIdx}`}>
                {hasSection && (
                  <tr
                    onClick={() => toggleSection(section.sectionIdx)}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <td
                      colSpan={colCount}
                      style={{
                        padding: "9px 14px",
                        background: "var(--bg2)",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "var(--text1)",
                        borderTop: "2px solid var(--border)",
                        borderBottom: isCollapsed ? "2px solid var(--border)" : "1px solid var(--border)",
                        letterSpacing: 0.3,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {isCollapsed
                          ? <ChevronRight size={13} style={{ color: "var(--text3)", flexShrink: 0 }} />
                          : <ChevronDown size={13} style={{ color: "var(--text3)", flexShrink: 0 }} />}
                        {section.sectionName}
                        <span style={{ marginLeft: 4, fontWeight: 400, fontSize: 11, color: "var(--text3)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "1px 7px" }}>
                          {section.items.length} та
                        </span>
                      </span>
                    </td>
                  </tr>
                )}
                {!isCollapsed && section.items.map(({ row, flatIdx }, ri) => {
                  globalRowIdx++;
                  const rowNum = globalRowIdx;
                  const isEditing = editingIdx === flatIdx;
                  return (
                    <tr key={`${section.sectionIdx}-${ri}`} style={isEditing ? { background: "var(--accent-dim)" } : undefined}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 40, padding: "0 4px", color: "var(--text1)", fontSize: 12 }}>
                        {String(rowNum).padStart(2, "0")}
                      </td>
                      {isEditing ? (
                        <>
                          <td><input className="form-input" placeholder="Nomi" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.name ?? row.name ?? ""} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} /></td>
                          <td><input className="form-input" placeholder="Birlik" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.unit ?? row.unit ?? ""} onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))} /></td>
                          <td><input className="form-input" placeholder="Tayyor" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.readyQty ?? row.readyQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, readyQty: e.target.value }))} /></td>
                          <td><input className="form-input" placeholder="Chiqindi" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.wasteQty ?? row.wasteQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, wasteQty: e.target.value }))} /></td>
                          <td><input className="form-input" placeholder="Umumiy" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.totalQty ?? row.totalQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, totalQty: e.target.value }))} /></td>
                          {showPhotos && (
                            <>
                              <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoRaw} /></td>
                              <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoSemi} /></td>
                            </>
                          )}
                          <td><input className="form-input" placeholder="Manba" style={{ width: "100%", padding: "4px 8px", fontSize: 13 }} value={editDraft.importType ?? row.importType ?? ""} onChange={e => setEditDraft(d => ({ ...d, importType: e.target.value }))} /></td>
                          <td style={{ borderLeft: "2px solid var(--border)", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button
                                onClick={() => {
                                  if (onUpdateRow) {
                                    onUpdateRow(flatIdx, {
                                      name: (editDraft.name ?? row.name) || "",
                                      unit: (editDraft.unit ?? row.unit) || "",
                                      readyQty: (editDraft.readyQty ?? row.readyQty) || "",
                                      wasteQty: (editDraft.wasteQty ?? row.wasteQty) || "",
                                      totalQty: (editDraft.totalQty ?? row.totalQty) || "",
                                      importType: (editDraft.importType ?? row.importType) || "",
                                    } as Partial<MaterialRow>);
                                  }
                                  setEditingIdx(null);
                                  setEditDraft({});
                                }}
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
                                onClick={() => { setEditingIdx(null); setEditDraft({}); }}
                                title="Bekor qilish"
                                style={{
                                  display: "inline-flex", alignItems: "center",
                                  padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                  background: "var(--bg3)", border: "1px solid var(--border)",
                                  color: "var(--text2)", cursor: "pointer",
                                }}
                              >✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ color: "var(--text1)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name ?? ""}>{row.name || "—"}</td>
                          <td style={{ textAlign: "center", color: "var(--text1)" }}>{row.unit || "—"}</td>
                          <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "Inter, sans-serif" }}>{row.readyQty || "—"}</td>
                          <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "Inter, sans-serif" }}>{row.wasteQty || "—"}</td>
                          <td style={{ textAlign: "center", color: "var(--text1)", fontFamily: "Inter, sans-serif" }}>{row.totalQty || "—"}</td>
                          {showPhotos && (
                            <>
                              <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoRaw} /></td>
                              <td style={{ padding: "6px 12px" }}><PhotoCell src={row.photoSemi} /></td>
                            </>
                          )}
                          <td style={{ textAlign: "center" }}>
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
                          {editable && (
                            <td style={{ borderLeft: "2px solid var(--border)", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  onClick={() => { setEditingIdx(flatIdx); setEditDraft({}); }}
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
                                  onClick={() => { if (onDeleteRow) onDeleteRow(flatIdx); }}
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
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          {rows.filter(r => !r.isSection).length === 0 && (
            <tr>
              <td colSpan={colCount} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                Ma&apos;lumot topilmadi
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = "list" | "create" | "detail" | "edit";

// ─── File parsing loading overlay ────────────────────────────────────────────

const fileLoadingKeyframes = `
@keyframes overlayFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes overlayFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes spinRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes orbitDot { 0% { transform: rotate(0deg) translateX(52px) rotate(0deg); opacity: 0.9; } 50% { opacity: 0.4; } 100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); opacity: 0.9; } }
@keyframes orbitDot2 { 0% { transform: rotate(120deg) translateX(52px) rotate(-120deg); opacity: 0.7; } 50% { opacity: 0.3; } 100% { transform: rotate(480deg) translateX(52px) rotate(-480deg); opacity: 0.7; } }
@keyframes orbitDot3 { 0% { transform: rotate(240deg) translateX(52px) rotate(-240deg); opacity: 0.5; } 50% { opacity: 0.2; } 100% { transform: rotate(600deg) translateX(52px) rotate(-600deg); opacity: 0.5; } }
@keyframes pulseCore { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); } 50% { transform: scale(1.08); box-shadow: 0 0 30px 8px rgba(59, 130, 246, 0.15); } }
@keyframes textFadeUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes dataStreamLine { 0% { transform: translateX(-100%); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateX(100%); opacity: 0; } }
`;

function FileParsingOverlay({ dataReady, onComplete }: { dataReady: boolean; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);
  const minDuration = 5000;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      let pct: number;
      if (elapsed < minDuration) {
        pct = Math.min(85, (elapsed / minDuration) * 85);
      } else if (!dataReady) {
        pct = Math.min(95, 85 + ((elapsed - minDuration) / 5000) * 10);
      } else {
        pct = 100;
      }
      setProgress(pct);
      if (elapsed > 1500) setPhase(1);
      if (elapsed > 3500) setPhase(2);

      if (elapsed >= minDuration && dataReady && !completedRef.current) {
        completedRef.current = true;
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(onComplete, 400);
        }, 300);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [dataReady, onComplete]);

  const phaseTexts = [
    "Fayl ma\u2018lumotlari o\u2018qilmoqda...",
    "Mahsulotlar jadvaldan ajratilmoqda...",
    "Ma\u2018lumotlar tayyorlanmoqda...",
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      background: "rgba(15, 23, 42, 0.65)",
      animation: fadeOut ? "overlayFadeOut 0.4s ease-out forwards" : "overlayFadeIn 0.3s ease-out",
    }}>
      <style dangerouslySetInnerHTML={{ __html: fileLoadingKeyframes }} />

      <div style={{ position: "relative", width: 130, height: 130, marginBottom: 32 }}>
        <div style={{ position: "absolute", inset: 12, borderRadius: "50%", border: "1px solid rgba(99, 152, 255, 0.15)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: "50%", background: "#60a5fa", animation: "orbitDot 2.5s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, borderRadius: "50%", background: "#818cf8", animation: "orbitDot2 3s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5, borderRadius: "50%", background: "#a78bfa", animation: "orbitDot3 3.5s linear infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 60, height: 60, marginLeft: -30, marginTop: -30, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#3b82f6", borderRightColor: "#6366f1", animation: "spinRing 1.2s linear infinite" }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 40, height: 40,
          marginLeft: -20, marginTop: -20, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
          animation: "pulseCore 2s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Document icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
      </div>

      <div style={{ width: 200, height: 3, marginBottom: 20, position: "relative", overflow: "hidden", borderRadius: 2, background: "rgba(99, 152, 255, 0.1)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #3b82f6, transparent)", animation: "dataStreamLine 1.5s ease-in-out infinite" }} />
      </div>

      <div key={phase} style={{ fontSize: 15, fontWeight: 500, color: "#e2e8f0", letterSpacing: 0.3, animation: "textFadeUp 0.4s ease-out", marginBottom: 8 }}>
        {phaseTexts[phase]}
      </div>

      <div style={{ fontSize: 12, color: "rgba(148, 163, 184, 0.8)", marginBottom: 24, animation: "textFadeUp 0.4s ease-out 0.15s both" }}>
        Ma&apos;lumotlar yuklanmoqda, biroz kutib turing
      </div>

      <div style={{ width: 260, height: 4, borderRadius: 2, background: "rgba(51, 65, 85, 0.6)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)", transition: "width 0.1s linear", boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)" }} />
      </div>

      <div style={{ fontSize: 11, color: "rgba(148, 163, 184, 0.6)", marginTop: 10, fontFamily: "Inter, monospace", letterSpacing: 1 }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
  const [detailFiles, setDetailFiles] = useState<AttachmentResponse[]>([]);
  const [detailItems, setDetailItems] = useState<CostNormItemResponse[]>([]);

  // Create form state
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [form, setForm] = useState({ contractId: "", title: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createTab, setCreateTab] = useState<"form" | "table">("form");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Approve state
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Edit state
  const [editingNorm, setEditingNorm] = useState<CostNormResponse | null>(null);
  const [editForm, setEditForm] = useState({ title: "", notes: "" });
  const [editItems, setEditItems] = useState<MaterialRow[]>([]);
  const [editFiles, setEditFiles] = useState<AttachmentResponse[]>([]);
  const [editNewFile, setEditNewFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  // Docx parsing (used in create form for preview)
  const [formFile, setFormFile] = useState<File | null>(null);
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const formFileRef = useRef<HTMLInputElement>(null);
  const [fileOverlayVisible, setFileOverlayVisible] = useState(false);
  const [fileParseReady, setFileParseReady] = useState(false);
  const pendingParseResult = useRef<{ tables: ParsedTable[]; error: string | null; fileName: string } | null>(null);

  useDraft(
    "draft_costnorm",
    mode === "create",
    form,
    (d) => {
      setForm(d);
      setMode("create");
      contractService.getAll().then(setContracts).catch(() => {});
    },
  );

  // ── Load list ─────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setListLoading(true);
    const data = await costNormService.getAll();
    setCostNorms(data);
    setListLoading(false);
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Browser back button handling ────────────────────────────────────────

  useEffect(() => {
    const handlePopState = () => {
      setMode(prev => {
        if (prev === "detail" || prev === "edit" || prev === "create") return "list";
        return prev;
      });
      setSelectedNorm(null);
      setEditingNorm(null);
      setSearch("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    setFileParseReady(false);
    setFileOverlayVisible(true);
    pendingParseResult.current = null;

    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const { tables: parsed, error: colError } = parseMainTables(result.value);
      if (colError) {
        pendingParseResult.current = { tables: [], error: colError, fileName: file.name };
      } else if (parsed.length === 0) {
        pendingParseResult.current = { tables: [], error: "Faylda mos jadval topilmadi.", fileName: file.name };
      } else {
        pendingParseResult.current = { tables: parsed, error: null, fileName: file.name };
      }
    } catch {
      pendingParseResult.current = { tables: [], error: "Faylni o'qishda xatolik yuz berdi", fileName: file.name };
    }
    setFileParseReady(true);
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
    setCreateTab("form");
    window.history.pushState({ mode: "create" }, "");
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

      const newId = await costNormService.create({
        contractId: form.contractId,
        title: form.title || formFile?.name?.replace(/\.docx$/i, "") || "Me'yoriy sarf",
        notes: form.notes || null,
        items,
      });

      if (formFile && newId) {
        await costNormService.uploadFile(newId, formFile);
      }

      await loadList();
      setMode("list");
    } catch {
      setSaveError("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  // ── Approve ──────────────────────────────────────────────────────────────

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      await costNormService.approve(id);
      setCostNorms(prev => prev.map(n => n.id === id ? { ...n, status: DrawingStatus.Approved } : n));
      if (selectedNorm?.id === id) setSelectedNorm(n => n ? { ...n, status: DrawingStatus.Approved } : n);
    } finally {
      setApprovingId(null);
    }
  }

  // ── Open edit ─────────────────────────────────────────────────────────────

  async function openEdit(norm: CostNormResponse) {
    setEditingNorm(norm);
    setEditForm({ title: norm.title, notes: norm.notes || "" });
    setEditItems(
      [...norm.items].sort((a, b) => a.sortOrder - b.sortOrder).map(it => ({
        no: it.no || "",
        name: it.name || "",
        unit: it.unit || "",
        readyQty: it.readyQty || "",
        wasteQty: it.wasteQty || "",
        totalQty: it.totalQty || "",
        photoRaw: it.photoRaw || "",
        photoSemi: it.photoSemi || "",
        importType: it.importType || "",
        isSection: it.isSection,
        sectionName: it.sectionName || "",
      }))
    );
    setEditNewFile(null);
    setEditSaveError(null);
    setEditSaving(false);
    setShowPhotos(false);
    window.history.pushState({ mode: "edit" }, "");
    setMode("edit");
    try {
      const files = await costNormService.getFiles(norm.id);
      setEditFiles(files);
    } catch {
      setEditFiles([]);
    }
  }

  // ── Edit docx parse ──────────────────────────────────────────────────────

  async function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setEditSaveError("Faqat .docx formatidagi fayllar qo'llab-quvvatlanadi");
      return;
    }
    setEditNewFile(file);
    setEditSaveError(null);
    setFileParseReady(false);
    setFileOverlayVisible(true);
    pendingParseResult.current = null;

    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const { tables: parsed, error: colError } = parseMainTables(result.value);
      if (colError) {
        pendingParseResult.current = { tables: [], error: colError, fileName: file.name };
      } else if (parsed.length > 0) {
        pendingParseResult.current = { tables: parsed, error: null, fileName: file.name };
      } else {
        pendingParseResult.current = { tables: [], error: null, fileName: file.name };
      }
    } catch {
      pendingParseResult.current = { tables: [], error: "Faylni o'qishda xatolik yuz berdi", fileName: file.name };
    }
    setFileParseReady(true);
  }

  // ── Save edit ────────────────────────────────────────────────────────────

  async function handleEditSave() {
    if (!editingNorm) return;
    setEditSaving(true);
    setEditSaveError(null);
    try {
      const items = editItems.map((row, idx) => ({
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

      await costNormService.update(editingNorm.id, {
        title: editForm.title,
        notes: editForm.notes || null,
        items,
      });

      // Handle new file upload
      if (editNewFile) {
        // Delete old files first
        for (const f of editFiles) {
          await costNormService.deleteFile(editingNorm.id, f.id);
        }
        await costNormService.uploadFile(editingNorm.id, editNewFile);
      }

      await loadList();
      setMode("list");
      setEditingNorm(null);
    } catch {
      setEditSaveError("Saqlashda xatolik yuz berdi");
    } finally {
      setEditSaving(false);
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
    setDetailFiles([]);
    setDetailItems([...norm.items].sort((a, b) => a.sortOrder - b.sortOrder));
    window.history.pushState({ mode: "detail" }, "");
    setMode("detail");
    costNormService.getFiles(norm.id).then(setDetailFiles).catch(() => {});
  }

  // ── Detail: split items into tables by section boundaries ─────────────────

  const detailTables = useMemo(() => {
    if (!selectedNorm) return [];
    return [{ title: selectedNorm.title, rows: detailItems }];
  }, [selectedNorm, detailItems]);

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
      n.title.toLowerCase().includes(q)
    );
  }, [costNorms, search]);

  // ── Render: Create ────────────────────────────────────────────────────────

  if (mode === "create") {
    const currentRows = parsedTables[activeTab]?.rows ?? [];
    const dataCount = currentRows.filter(r => !r.isSection).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

        {fileOverlayVisible && (
          <FileParsingOverlay dataReady={fileParseReady} onComplete={() => {
            setFileOverlayVisible(false);
            setParseLoading(false);
            const result = pendingParseResult.current;
            if (result) {
              if (result.error) {
                setParseError(result.error);
              } else {
                setParsedTables(result.tables);
                setCreateTab("table");
                if (!form.title) {
                  setForm(f => ({ ...f, title: result.fileName.replace(/\.docx$/i, "") }));
                }
              }
            }
          }} />
        )}

        {/* ── Tab bar ── */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16, padding: "0 16px", flexShrink: 0 }}>
          <button
            onClick={() => setCreateTab("form")}
            style={{ padding: "12px 20px", fontSize: 13, fontWeight: createTab === "form" ? 700 : 500, color: createTab === "form" ? "var(--accent,#1a56db)" : "var(--text2)", background: "none", border: "none", borderBottom: createTab === "form" ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}
          >
            Forma
          </button>
          <button
            onClick={() => parsedTables.length > 0 && setCreateTab("table")}
            style={{ padding: "12px 20px", fontSize: 13, fontWeight: createTab === "table" ? 700 : 500, color: createTab === "table" ? "var(--accent,#1a56db)" : parsedTables.length === 0 ? "var(--text3)" : "var(--text2)", background: "none", border: "none", borderBottom: createTab === "table" ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: parsedTables.length > 0 ? "pointer" : "default", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}
          >
            Jadval ko&apos;rinishi
            {parsedTables.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, background: "var(--accent,#1a56db)", color: "#fff", borderRadius: 20, padding: "1px 7px" }}>{dataCount}</span>
            )}
            {parseLoading && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
          </button>

          <div style={{ flex: 1 }} />

          {/* Action buttons always visible */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(parseError || saveError) && (
              <span style={{ fontSize: 12, color: "var(--danger)" }}>{parseError || saveError}</span>
            )}
            <button onClick={() => setMode("list")} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 18px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
              Bekor qilish
            </button>
            <button onClick={handleSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 20px", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, border: "1.5px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? "Saqlanmoqda..." : "Qoralama saqlash"}
            </button>
          </div>
        </div>

        {/* ── Forma tab ── */}
        {createTab === "form" && (
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="itm-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Shartnoma */}
                <div>
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
                        {c.contractNo}
                      </option>
                    ))}
                  </select>
                  {submitted && !form.contractId && (
                    <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Shartnoma tanlash shart</div>
                  )}
                </div>

                {/* Sarlavha */}
                <div>
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
                <div>
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
                      <button onClick={() => { setFormFile(null); setParsedTables([]); setCreateTab("form"); if (formFileRef.current) formFileRef.current.value = ""; }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text3)", display: "flex" }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => formFileRef.current?.click()}
                      style={{ width: "100%", padding: "22px 0", borderRadius: "var(--radius)", border: `1.5px dashed ${submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--border)"}`, background: "var(--bg2)", cursor: "pointer", color: submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--text2)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "border-color 0.15s, color 0.15s" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--accent)";
                        e.currentTarget.style.color = "var(--accent)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--border)";
                        e.currentTarget.style.color = submitted && parsedTables.length === 0 ? "var(--danger)" : "var(--text2)";
                      }}
                    >
                      <Upload size={15} />
                      Fayl tanlang yoki bu yerga tashlang
                    </button>
                  )}
                  {submitted && parsedTables.length === 0 && !parseLoading && (
                    <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Fayl yuklash va jadval topilishi shart</div>
                  )}
                  {parseLoading && (
                    <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Fayl o&apos;qilmoqda...
                    </div>
                  )}
                  {parsedTables.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>{dataCount} ta yozuv topildi</span>
                      <button onClick={() => setCreateTab("table")} style={{ fontSize: 12, color: "var(--accent,#1a56db)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Jadvalga o&apos;tish →
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── Jadval tab ── */}
        {createTab === "table" && (
          <div className="itm-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {/* Table toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {parsedTables.length} ta jadval · {dataCount} ta yozuv
              </span>
              {parsedTables.length > 1 && (
                <div style={{ display: "flex", gap: 4 }}>
                  {parsedTables.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveTab(i)}
                      style={{ padding: "3px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", fontWeight: activeTab === i ? 700 : 400, background: activeTab === i ? "var(--accent,#1a56db)" : "var(--bg2)", color: activeTab === i ? "#fff" : "var(--text2)", whiteSpace: "nowrap" }}
                    >
                      {t.title} <span style={{ opacity: 0.75 }}>({t.rows.filter(r => !r.isSection).length})</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", height: 30, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: showPhotos ? "var(--accent-dim,#e8f0fe)" : "var(--bg2)", color: showPhotos ? "var(--accent,#1a56db)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                {showPhotos ? <Image size={12} /> : <ImageOff size={12} />}
                {showPhotos ? "Yashirish" : "Fotolar"}
              </button>
            </div>
            <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
              <CollapsibleItemsTable rows={currentRows} showPhotos={showPhotos} onUpdateRow={(flatIdx, updated) => {
                setParsedTables(prev => {
                  const next = [...prev];
                  const tab = { ...next[activeTab], rows: [...next[activeTab].rows] };
                  tab.rows[flatIdx] = { ...tab.rows[flatIdx], ...updated };
                  next[activeTab] = tab;
                  return next;
                });
              }} onDeleteRow={(flatIdx) => {
                setParsedTables(prev => {
                  const next = [...prev];
                  const tab = { ...next[activeTab], rows: [...next[activeTab].rows] };
                  tab.rows.splice(flatIdx, 1);
                  next[activeTab] = tab;
                  return next;
                });
              }} />
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── Render: Edit ──────────────────────────────────────────────────────────

  if (mode === "edit" && editingNorm) {
    const editDataCount = editItems.filter(r => !r.isSection).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

        {fileOverlayVisible && (
          <FileParsingOverlay dataReady={fileParseReady} onComplete={() => {
            setFileOverlayVisible(false);
            const result = pendingParseResult.current;
            if (result) {
              if (result.error) {
                setEditSaveError(result.error);
              } else if (result.tables.length > 0) {
                setEditItems(result.tables.flatMap(t => t.rows));
              }
            }
          }} />
        )}

        {/* ── Tab bar ── */}
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16, padding: "0 16px", flexShrink: 0 }}>
          <button
            onClick={() => setActiveTab(-1)}
            style={{ padding: "12px 20px", fontSize: 13, fontWeight: activeTab === -1 ? 700 : 500, color: activeTab === -1 ? "var(--accent,#1a56db)" : "var(--text2)", background: "none", border: "none", borderBottom: activeTab === -1 ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}
          >
            Forma
          </button>
          <button
            onClick={() => setActiveTab(0)}
            style={{ padding: "12px 20px", fontSize: 13, fontWeight: activeTab === 0 ? 700 : 500, color: activeTab === 0 ? "var(--accent,#1a56db)" : "var(--text2)", background: "none", border: "none", borderBottom: activeTab === 0 ? "2px solid var(--accent,#1a56db)" : "2px solid transparent", cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}
          >
            Jadval ko&apos;rinishi
            <span style={{ fontSize: 11, fontWeight: 600, background: "var(--accent,#1a56db)", color: "#fff", borderRadius: 20, padding: "1px 7px" }}>{editDataCount}</span>
          </button>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {editSaveError && (
              <span style={{ fontSize: 12, color: "var(--danger)" }}>{editSaveError}</span>
            )}
            <button onClick={() => { setMode("list"); setEditingNorm(null); }} style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", padding: "7px 18px", color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>
              Bekor qilish
            </button>
            <button className="btn-primary" onClick={handleEditSave} disabled={editSaving} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 20px", borderRadius: "var(--radius)", fontSize: 13 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {editSaving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>

        {/* ── Asl fayl ── */}
        {(editFiles.length > 0 || editNewFile) && (
          <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#2563eb)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontSize: 13, color: "var(--text1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {editNewFile ? editNewFile.name : editFiles[0]?.fileName}
            </span>
            {!editNewFile && editFiles.length > 0 && (
              <button
                onClick={() => costNormService.downloadFile(editingNorm.id, editFiles[0].id, editFiles[0].fileName)}
                title="Yuklab olish"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Yuklab olish
              </button>
            )}
            <input ref={editFileRef} type="file" accept=".docx" title="Fayl tanlash" style={{ display: "none" }} onChange={handleEditFileChange} />
            <button
              onClick={() => editFileRef.current?.click()}
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
          </div>
        )}

        {/* Fayl yo'q bo'lsa - yuklash */}
        {editFiles.length === 0 && !editNewFile && (
          <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px" }}>
            <input ref={editFileRef} type="file" accept=".docx" title="Fayl tanlash" style={{ display: "none" }} onChange={handleEditFileChange} />
            <button
              onClick={() => editFileRef.current?.click()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: "var(--bg3)", border: "1.5px dashed var(--border)",
                color: "var(--text2)", cursor: "pointer",
              }}
            >
              <Upload size={14} />
              Fayl yuklash
            </button>
          </div>
        )}

        {/* ── Forma tab ── */}
        {activeTab === -1 && (
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="itm-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Shartnoma (read-only) */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                    Shartnoma
                  </label>
                  <input
                    className="form-input"
                    value={editingNorm.contractNo}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </div>

                {/* Sarlavha */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                    Sarlavha
                  </label>
                  <input
                    className="form-input"
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Sarlavha"
                  />
                </div>

                {/* Izoh */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 7, color: "var(--text2)" }}>
                    Izoh
                  </label>
                  <input
                    className="form-input"
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Izoh (ixtiyoriy)"
                  />
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── Jadval tab ── */}
        {activeTab === 0 && (
          <div className="itm-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {editDataCount} ta yozuv
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowPhotos(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", height: 30, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: showPhotos ? "var(--accent-dim,#e8f0fe)" : "var(--bg2)", color: showPhotos ? "var(--accent,#1a56db)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
                {showPhotos ? <Image size={12} /> : <ImageOff size={12} />}
                {showPhotos ? "Yashirish" : "Fotolar"}
              </button>
            </div>
            <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
              <CollapsibleItemsTable rows={editItems} showPhotos={showPhotos} onUpdateRow={(flatIdx, updated) => {
                setEditItems(prev => {
                  const next = [...prev];
                  next[flatIdx] = { ...next[flatIdx], ...updated };
                  return next;
                });
              }} onDeleteRow={(flatIdx) => {
                setEditItems(prev => {
                  const next = [...prev];
                  next.splice(flatIdx, 1);
                  return next;
                });
              }} />
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── Render: Detail ────────────────────────────────────────────────────────

  if (mode === "detail" && selectedNorm) {
    const norm = selectedNorm;
    const dataCount = filteredDetail.filter(r => !r.isSection).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", flexWrap: "wrap" }}>
          <button onClick={() => { setMode("list"); setSelectedNorm(null); setSearch(""); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
            ← Orqaga
          </button>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {norm.title}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "2px 10px",
                borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                background: norm.status === DrawingStatus.Approved ? "var(--success-dim)" : "var(--bg3)",
                color: norm.status === DrawingStatus.Approved ? "var(--success)" : "var(--text2)",
                border: `1px solid ${norm.status === DrawingStatus.Approved ? "rgba(15,123,69,0.2)" : "var(--border)"}`,
              }}>
                {DRAWING_STATUS_LABELS[norm.status ?? DrawingStatus.Draft]}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {norm.contractNo} · {(() => { const d = norm.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—"; })()}
            </span>
          </div>

          {norm.status === DrawingStatus.Draft && (
            <button
              onClick={() => handleApprove(norm.id)}
              disabled={approvingId === norm.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: "var(--radius)", border: "1px solid rgba(15,123,69,0.3)", background: "var(--success-dim)", color: "var(--success)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {approvingId === norm.id ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
            </button>
          )}

          {detailFiles.length > 0 && (
            <button
              onClick={() => costNormService.downloadFile(norm.id, detailFiles[0].id, detailFiles[0].fileName)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
              title={detailFiles[0].fileName}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Asl fayl
            </button>
          )}

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
            <CollapsibleItemsTable rows={filteredDetail} showPhotos={showPhotos} />
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
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 18px", height: 36, fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", borderTop: "none", borderRight: "none", borderBottom: "none", borderLeft: "none", cursor: "pointer" }}
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
                  <th style={{ width: 64, minWidth: 64, textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text1)", textTransform: "none" }}>T/r</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Shartnoma</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sarlavha</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Yozuvlar</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Status</th>
                  <th style={{ textAlign: "center", color: "var(--text1)" }}>Sana</th>
                  <th style={{ textAlign: "center", borderLeft: "2px solid var(--border)", color: "var(--text1)" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((norm, i) => {
                  const dataItems = norm.items.filter(it => !it.isSection).length;
                  return (
                    <tr key={norm.id}>
                      <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", minWidth: 64, padding: "0 8px" }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ textAlign: "center", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <button onClick={() => openDetail(norm)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text1)", fontFamily: "var(--font-mono)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                          {norm.contractNo}
                        </button>
                      </td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text1)" }}>{norm.title}</td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontSize: 12 }}>{dataItems}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", padding: "2px 10px",
                          borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: norm.status === DrawingStatus.Approved ? "var(--success-dim)" : "var(--bg3)",
                          color: norm.status === DrawingStatus.Approved ? "var(--success)" : "var(--text2)",
                          border: `1px solid ${norm.status === DrawingStatus.Approved ? "rgba(15,123,69,0.2)" : "var(--border)"}`,
                        }}>
                          {DRAWING_STATUS_LABELS[norm.status ?? DrawingStatus.Draft]}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text1)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {(() => { const d = norm.createdAt?.slice(0, 10).split("-"); return d && d.length === 3 ? `${d[2]}-${d[1]}-${d[0].slice(-2)}` : "—"; })()}
                      </td>
                      <td style={{ borderLeft: "2px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button className="btn-icon" onClick={() => openDetail(norm)} title="Ko'rish"
                            style={{ color: "#0ea5e9", borderColor: "#0ea5e933", background: "#0ea5e912" }}>
                            <Eye size={14} />
                          </button>
                          <button className="btn-icon" onClick={() => openEdit(norm)} title="Tahrirlash"
                            style={{ color: "#22c55e", borderColor: "#22c55e33", background: "#22c55e12" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {norm.status === DrawingStatus.Draft && (
                            <button className="btn-icon" onClick={() => handleApprove(norm.id)} disabled={approvingId === norm.id} title="Tasdiqlash"
                              style={{ color: "var(--success)", borderColor: "rgba(15,123,69,0.2)", background: "var(--success-dim)" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                          )}
                          <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(norm.id)} title="O'chirish"
                            style={{ color: "var(--danger)", borderColor: "var(--danger)33", background: "var(--danger-dim)" }}>
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
