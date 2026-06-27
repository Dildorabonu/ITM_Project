"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { type CostNormItemResponse, type CostNormMetadata } from "@/lib/userService";
import { useT } from "@/lib/i18n";
import { type MaterialRow } from "../_types";
import { PhotoCell } from "./PhotoCell";

// 96dpi: 1mm = 3.7795px → A4 portrait minimum, sheet kengayadi screen da
const MM_TO_PX = 96 / 25.4;
const A4_MIN_W = Math.round(210 * MM_TO_PX);  // 794 — print A4 minimum
const SHEET_MAX_W = 1200;                     // screen da maksimum kenglik
const PAD_TOP = Math.round(12 * MM_TO_PX);
const PAD_BOTTOM = Math.round(12 * MM_TO_PX);
const PAD_LEFT = Math.round(10 * MM_TO_PX);
const PAD_RIGHT = Math.round(10 * MM_TO_PX);

type NormRow = {
  isSection: boolean; sectionName: string | null; name: string | null; unit: string | null;
  readyQty: string | null; wasteQty: string | null; totalQty: string | null;
  photoRaw: string | null; photoSemi: string | null; importType: string | null;
};

function normalizeRow(r: MaterialRow | CostNormItemResponse): NormRow {
  if ("no" in r && typeof (r as MaterialRow).no === "string" && !("sortOrder" in r)) {
    const mr = r as MaterialRow;
    return { isSection: mr.isSection, sectionName: mr.sectionName || mr.name || null, name: mr.name || null, unit: mr.unit || null, readyQty: mr.readyQty || null, wasteQty: mr.wasteQty || null, totalQty: mr.totalQty || null, photoRaw: mr.photoRaw || null, photoSemi: mr.photoSemi || null, importType: mr.importType || null };
  }
  const ir = r as CostNormItemResponse;
  return { isSection: ir.isSection, sectionName: ir.sectionName, name: ir.name, unit: ir.unit, readyQty: ir.readyQty, wasteQty: ir.wasteQty, totalQty: ir.totalQty, photoRaw: ir.photoRaw, photoSemi: ir.photoSemi, importType: ir.importType };
}

export interface CostNormA4SheetProps {
  rows: (MaterialRow | CostNormItemResponse)[];
  showPhotos: boolean;
  title?: string;
  contractNo?: string;
  productType?: string | null;
  metadata?: CostNormMetadata | null;
  onUpdateRow?: (flatIdx: number, updated: Partial<MaterialRow>) => void;
  onDeleteRow?: (flatIdx: number) => void;
}

export function CostNormA4Sheet({ rows, showPhotos, title, contractNo, productType, metadata, onUpdateRow, onDeleteRow }: CostNormA4SheetProps) {
  const t = useT();
  const editable = !!onUpdateRow;
  const normalized = useMemo(() => rows.map(normalizeRow), [rows]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<NormRow>>({});

  const sections = useMemo(() => {
    const groups: { sectionIdx: number; sectionName: string; items: { row: NormRow; flatIdx: number }[] }[] = [];
    let current = { sectionIdx: 0, sectionName: "", items: [] as { row: NormRow; flatIdx: number }[] };
    let sectionIdx = 0;
    for (let fi = 0; fi < normalized.length; fi++) {
      const row = normalized[fi];
      if (row.isSection) {
        if (current.items.length > 0 || current.sectionName) groups.push(current);
        sectionIdx++;
        current = { sectionIdx, sectionName: row.sectionName || "", items: [] };
      } else { current.items.push({ row, flatIdx: fi }); }
    }
    groups.push(current);
    return groups;
  }, [normalized]);

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleSection = (idx: number) => setCollapsed(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  const collapseAll = () => setCollapsed(new Set(sections.map(s => s.sectionIdx)));
  const expandAll = () => setCollapsed(new Set());
  const allCollapsed = collapsed.size === sections.filter(s => s.sectionName).length;
  const colCount = (showPhotos ? 9 : 7) + (editable ? 1 : 0);
  let globalRowIdx = 0;

  const hasMetadataHeader = !!metadata && (metadata.approvalLeft.length > 0 || metadata.approvalRight.length > 0);
  const hasSignatures = !!metadata && metadata.signatures.length > 0;
  const dataCount = normalized.filter(r => !r.isSection).length;

  return (
    <div className="cn-a4-stack" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "8px 0 32px", width: "100%" }}>
      <style>{`
        .cn-a4-sheet table { border-collapse: collapse; width: 100%; font-family: "Times New Roman", serif; }
        .cn-a4-sheet th {
          background: #b8860b;
          color: #fff;
          border: 1px solid #5a3f00;
          padding: 7px 6px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          line-height: 1.35;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .cn-a4-sheet td {
          border: 1px solid #ccc;
          padding: 5px 7px;
          font-family: "Times New Roman", serif;
          font-size: 12px;
          color: #000;
          vertical-align: top;
          word-break: break-word;
        }
        .cn-a4-sheet td.cn-photo-cell {
          padding: 4px;
          text-align: center;
          vertical-align: middle;
          min-width: 76px;
          width: 76px;
        }
        .cn-a4-sheet td.cn-photo-cell img {
          width: 64px !important;
          height: 64px !important;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #d4a900;
          cursor: pointer;
          display: inline-block;
        }
        .cn-a4-sheet td.cn-photo-cell span {
          color: #999;
          font-size: 11px;
        }
        .cn-a4-sheet td.cn-import-cell { white-space: nowrap; min-width: 88px; }
        .cn-a4-sheet td.cn-action-col { white-space: nowrap; min-width: 96px; width: 96px; }
        .cn-a4-sheet .cn-section-row td {
          background: #f7eed1;
          border-top: 2px solid #b8860b;
          border-bottom: 1px solid #b8860b;
          padding: 6px 10px;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.2px;
          color: #5a3f00;
          font-family: "Times New Roman", serif;
        }
        .cn-a4-sheet .cn-cell-input {
          width: 100%;
          border: none;
          background: transparent;
          font-family: "Times New Roman", serif;
          font-size: 12px;
          color: #000;
          padding: 0;
          outline: none;
        }
        .cn-a4-sheet .cn-edit-actions { display: flex; gap: 4px; justify-content: center; }
        @media print {
          .cn-a4-toolbar, .cn-edit-actions, .cn-action-col, .cn-section-toggle { display: none !important; }
          .cn-a4-sheet { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; }
        }
      `}</style>

      {sections.some(s => s.sectionName) && (
        <div className="cn-a4-toolbar" style={{ width: "100%", maxWidth: SHEET_MAX_W, display: "flex", justifyContent: "flex-end", padding: "0 4px" }}>
          <button onClick={allCollapsed ? expandAll : collapseAll}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text2)", fontSize: 11, cursor: "pointer" }}>
            {allCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
            {allCollapsed ? t("Barchani ochish") : t("Barchani yig'ish")}
          </button>
        </div>
      )}

      <div
        className="cn-a4-sheet"
        style={{
          background: "#fff",
          color: "#000",
          fontFamily: "Times New Roman, serif",
          fontSize: 13,
          width: "100%",
          minWidth: A4_MIN_W,
          maxWidth: SHEET_MAX_W,
          minHeight: 400,
          padding: `${PAD_TOP}px ${PAD_RIGHT}px ${PAD_BOTTOM}px ${PAD_LEFT}px`,
          boxSizing: "border-box",
          boxShadow: "var(--shadow2)",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}
      >
        {/* Document header: approval blocks + title */}
        {hasMetadataHeader && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 18, fontFamily: "Times New Roman, serif", fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ flex: 1 }}>
              {metadata!.approvalLeft.map((line, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
              ))}
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              {metadata!.approvalRight.map((line, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", margin: hasMetadataHeader ? "8px 0 14px" : "0 0 16px", fontFamily: "Times New Roman, serif" }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>{t("МЕЪЁРИЙ САРФ")}</div>
          {title && <div style={{ fontSize: 13, marginTop: 4 }}>{title}</div>}
          {(contractNo || productType) && (
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
              {contractNo && <span>{t("Шартнома")}: <strong style={{ color: "#000" }}>{contractNo}</strong></span>}
              {contractNo && productType && <span> &nbsp;·&nbsp; </span>}
              {productType && <span>{t("Маҳсулот")}: <strong style={{ color: "#000" }}>{productType}</strong></span>}
            </div>
          )}
        </div>

        {/* Table */}
        <table style={{ tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={{ width: 42 }}>{t("Т/р")}</th>
              <th>{t("Материал номи")}</th>
              <th>{t("Ўлчов")}</th>
              <th>{t("Тайёр маҳсулот")}</th>
              <th>{t("Чиқинди")}</th>
              <th>{t("Умумий сарф")}</th>
              {showPhotos && <><th>{t("Хом-ашё")}</th><th>{t("Ярим тайёр")}</th></>}
              <th>{t("Манба")}</th>
              {editable && <th className="cn-action-col" style={{ width: 70 }}>{t("Амал")}</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map(section => {
              const isCollapsed = collapsed.has(section.sectionIdx);
              const hasSection = !!section.sectionName;
              return (
                <React.Fragment key={`s-${section.sectionIdx}`}>
                  {hasSection && (
                    <tr className="cn-section-row cn-section-toggle" onClick={() => toggleSection(section.sectionIdx)} style={{ cursor: "pointer", userSelect: "none" }}>
                      <td colSpan={colCount}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          {isCollapsed ? <ChevronRight size={13} style={{ flexShrink: 0 }} /> : <ChevronDown size={13} style={{ flexShrink: 0 }} />}
                          {section.sectionName}
                          <span style={{ marginLeft: 4, fontWeight: 400, fontSize: 10, color: "#5a3f00", background: "#fff", border: "1px solid #b8860b", borderRadius: 20, padding: "1px 7px" }}>{section.items.length} {t("та")}</span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed && section.items.map(({ row, flatIdx }, ri) => {
                    globalRowIdx++;
                    const rowNum = globalRowIdx;
                    const isEditing = editingIdx === flatIdx;
                    return (
                      <tr key={`${section.sectionIdx}-${ri}`} style={isEditing ? { background: "#fffaeb" } : undefined}>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{String(rowNum).padStart(2, "0")}</td>
                        {isEditing ? (
                          <>
                            <td><input className="cn-cell-input" placeholder={t("Nomi")} value={editDraft.name ?? row.name ?? ""} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} /></td>
                            <td><input className="cn-cell-input" placeholder={t("Birlik")} value={editDraft.unit ?? row.unit ?? ""} onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))} /></td>
                            <td><input className="cn-cell-input" placeholder={t("Tayyor")} value={editDraft.readyQty ?? row.readyQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, readyQty: e.target.value }))} /></td>
                            <td><input className="cn-cell-input" placeholder={t("Chiqindi")} value={editDraft.wasteQty ?? row.wasteQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, wasteQty: e.target.value }))} /></td>
                            <td><input className="cn-cell-input" placeholder={t("Umumiy")} value={editDraft.totalQty ?? row.totalQty ?? ""} onChange={e => setEditDraft(d => ({ ...d, totalQty: e.target.value }))} /></td>
                            {showPhotos && <><td className="cn-photo-cell"><PhotoCell src={row.photoRaw} /></td><td className="cn-photo-cell"><PhotoCell src={row.photoSemi} /></td></>}
                            <td><input className="cn-cell-input" placeholder={t("Manba")} value={editDraft.importType ?? row.importType ?? ""} onChange={e => setEditDraft(d => ({ ...d, importType: e.target.value }))} /></td>
                            <td className="cn-action-col" style={{ textAlign: "center" }}>
                              <div className="cn-edit-actions">
                                <button onClick={() => { if (onUpdateRow) onUpdateRow(flatIdx, { name: (editDraft.name ?? row.name) || "", unit: (editDraft.unit ?? row.unit) || "", readyQty: (editDraft.readyQty ?? row.readyQty) || "", wasteQty: (editDraft.wasteQty ?? row.wasteQty) || "", totalQty: (editDraft.totalQty ?? row.totalQty) || "", importType: (editDraft.importType ?? row.importType) || "" } as Partial<MaterialRow>); setEditingIdx(null); setEditDraft({}); }}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#22c55e22", border: "1px solid #22c55e44", color: "#1b8a3f", cursor: "pointer", fontFamily: "Arial, sans-serif" }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                  {t("Saqlash")}
                                </button>
                                <button onClick={() => { setEditingIdx(null); setEditDraft({}); }}
                                  style={{ display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#f3f4f6", border: "1px solid #d1d5db", color: "#4b5563", cursor: "pointer", fontFamily: "Arial, sans-serif" }}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: "left", lineHeight: 1.4 }} title={row.name ?? ""}>{row.name || "—"}</td>
                            <td style={{ textAlign: "center" }}>{row.unit || "—"}</td>
                            <td style={{ textAlign: "center", fontFamily: "Times New Roman, serif" }}>{row.readyQty || "—"}</td>
                            <td style={{ textAlign: "center", fontFamily: "Times New Roman, serif" }}>{row.wasteQty || "—"}</td>
                            <td style={{ textAlign: "center", fontFamily: "Times New Roman, serif" }}>{row.totalQty || "—"}</td>
                            {showPhotos && <><td className="cn-photo-cell"><PhotoCell src={row.photoRaw} /></td><td className="cn-photo-cell"><PhotoCell src={row.photoSemi} /></td></>}
                            <td className="cn-import-cell" style={{ textAlign: "center" }}>
                              {row.importType ? (
                                <span style={{
                                  display: "inline-block", padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600, fontFamily: "Arial, sans-serif", whiteSpace: "nowrap",
                                  background: row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#e6f4ea" : "#e8f0fe",
                                  color: row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#1e7e34" : "#1a56db",
                                  border: `1px solid ${row.importType.toLowerCase().includes("местный") || row.importType.toLowerCase().includes("локал") ? "#a8d5b5" : "#a4c0f4"}`,
                                }}>{row.importType}</span>
                              ) : "—"}
                            </td>
                            {editable && (
                              <td className="cn-action-col" style={{ textAlign: "center" }}>
                                <div className="cn-edit-actions">
                                  <button onClick={() => { setEditingIdx(flatIdx); setEditDraft({}); }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#3b82f622", border: "1px solid #3b82f644", color: "#1e40af", cursor: "pointer", fontFamily: "Arial, sans-serif" }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    {t("Tahrir")}
                                  </button>
                                  <button onClick={() => { if (onDeleteRow) onDeleteRow(flatIdx); }}
                                    style={{ display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", cursor: "pointer", fontFamily: "Arial, sans-serif" }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
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
            {dataCount === 0 && (
              <tr><td colSpan={colCount} style={{ textAlign: "center", color: "#555", padding: 32, fontFamily: "Times New Roman, serif" }}>{t("Ma'lumot topilmadi")}</td></tr>
            )}
          </tbody>
        </table>

        {/* Signature block — original DOCX layout: title chap, ism o'ng */}
        {hasSignatures && (
          <div style={{
            marginTop: 32,
            fontFamily: "Times New Roman, serif",
            pageBreakInside: "avoid",
            breakInside: "avoid",
          }}>
            {metadata!.signatures.map((s, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                columnGap: 40,
                alignItems: "start",
                marginBottom: 18,
                fontSize: 12,
                lineHeight: 1.5,
              }}>
                <div style={{
                  color: "#000",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}>{s.title}</div>
                <div style={{
                  color: "#000",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  paddingTop: 1,
                }}>{s.name}</div>
              </div>
            ))}
          </div>
        )}

        {metadata?.footerNote && (
          <div style={{ marginTop: 18, fontSize: 10, color: "#555", fontFamily: "Times New Roman, serif", whiteSpace: "pre-wrap" }}>{metadata.footerNote}</div>
        )}
      </div>
    </div>
  );
}
