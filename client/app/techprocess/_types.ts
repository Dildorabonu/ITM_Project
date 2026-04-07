import {
  ProcessStatus,
  DrawingStatus,
  PROCESS_STATUS_LABELS,
  DRAWING_STATUS_LABELS,
  type TechProcessResponse,
  type CostNormResponse,
  type CostNormItemResponse,
} from "@/lib/userService";

export type { TechProcessResponse, CostNormResponse, CostNormItemResponse };
export { ProcessStatus, DrawingStatus, PROCESS_STATUS_LABELS, DRAWING_STATUS_LABELS };

// ─── Modes ────────────────────────────────────────────────────────────────────

export type TpMode = "list" | "detail" | "edit";
export type CnMode = "list" | "create" | "detail" | "edit";

// ─── Material row types ───────────────────────────────────────────────────────

export interface MaterialRow {
  no: string; name: string; unit: string;
  readyQty: string; wasteQty: string; totalQty: string;
  photoRaw: string; photoSemi: string; importType: string;
  isSection: boolean; sectionName: string;
}
export interface ParsedTable { title: string; rows: MaterialRow[]; }
export type ColField = "no"|"name"|"unit"|"readyQty"|"wasteQty"|"totalQty"|"photoRaw"|"photoSemi"|"importType";

// ─── Contract readiness ───────────────────────────────────────────────────────

export interface ContractReadinessItem {
  contractId: string;
  contractNo: string;
  tp: TechProcessResponse | null;
  cn: CostNormResponse | null;
}

// ─── DOCX column definitions ──────────────────────────────────────────────────

export const REQUIRED_COLS: { field: ColField; label: string; test: (t: string) => boolean }[] = [
  { field: "no",        label: "№ т/р",               test: t => t.includes("№") },
  { field: "name",      label: "Ҳом-ашё номи",         test: t => t.includes("номи") },
  { field: "unit",      label: "Ўлчов бирлиги",        test: t => t.includes("лчов") },
  { field: "readyQty",  label: "Тайёр маҳсулот",       test: t => t.includes("тайёр") && !t.includes("ярим") },
  { field: "wasteQty",  label: "Ҳом-ашё чиқиндиси",    test: t => t.includes("иқинди") },
  { field: "totalQty",  label: "Умумий ҳом-ашё сарфи", test: t => t.includes("мумий") },
  { field: "importType",label: "Импорт / Местный",     test: t => t.includes("импорт") },
];
export const OPTIONAL_COLS: { field: ColField; test: (t: string) => boolean }[] = [
  { field: "photoRaw",  test: t => t.includes("хом") && !t.includes("иқинди") && !t.includes("номи") },
  { field: "photoSemi", test: t => t.includes("ярим") },
];

// ─── DOCX parsing ─────────────────────────────────────────────────────────────

export function buildColMap(thead: Element): { colMap: Partial<Record<ColField,number>>; error: string|null } {
  const rows = Array.from(thead.querySelectorAll("tr"));
  if (!rows.length) return { colMap: {}, error: "Header qatori topilmadi" };
  const MAX = 12;
  const grid: (string|null)[][] = Array.from({ length: rows.length }, () => Array(MAX).fill(null));
  for (let ri = 0; ri < rows.length; ri++) {
    const cells = Array.from(rows[ri].querySelectorAll("td, th"));
    let ci = 0;
    for (const cell of cells) {
      while (ci < MAX && grid[ri][ci] !== null) ci++;
      if (ci >= MAX) break;
      const cs = Math.max(1, parseInt(cell.getAttribute("colspan")||"1"));
      const rs = Math.max(1, parseInt(cell.getAttribute("rowspan")||"1"));
      const text = (cell.textContent?.trim()||"").toLowerCase();
      for (let r = ri; r < Math.min(ri+rs,rows.length); r++)
        for (let c = ci; c < Math.min(ci+cs,MAX); c++)
          if (grid[r][c]===null) grid[r][c]=text;
      ci += cs;
    }
  }
  const lastRow = grid[rows.length-1];
  const colMap: Partial<Record<ColField,number>> = {};
  const missing: string[] = [];
  for (const { field,label,test } of REQUIRED_COLS) {
    const idx = lastRow.findIndex(t => t!==null && test(t));
    if (idx===-1) missing.push(label); else colMap[field]=idx;
  }
  if (missing.length>0) return { colMap, error: `Fayl shablonga mos emas. Ustunlar topilmadi: ${missing.join(", ")}` };
  for (const { field,test } of OPTIONAL_COLS) {
    const idx = lastRow.findIndex(t => t!==null && test(t));
    if (idx!==-1) colMap[field]=idx;
  }
  return { colMap, error: null };
}

export function parseMainTables(html: string): { tables: ParsedTable[]; error: string|null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const results: ParsedTable[] = [];
  let idx = 0;
  for (const table of tables) {
    const thead = table.querySelector("thead");
    if (!thead || !(thead.textContent||"").includes("лчов")) continue;
    const { colMap, error } = buildColMap(thead);
    if (error) return { tables: [], error };
    idx++;
    const rows: MaterialRow[] = [];
    for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(tr.querySelectorAll("td, th"));
      if (cells.some(td=>parseInt(td.getAttribute("colspan")||"1")>=5)) {
        const text = tr.textContent?.trim()||"";
        if (text) rows.push({ isSection:true, sectionName:text, no:"",name:"",unit:"",readyQty:"",wasteQty:"",totalQty:"",photoRaw:"",photoSemi:"",importType:"" });
        continue;
      }
      if (cells.length<3) continue;
      const gt = (i: number) => cells[i]?.textContent?.trim()||"";
      const gp = (i: number) => cells[i]?.querySelector("img")?.getAttribute("src")||"";
      const name = colMap.name!==undefined ? gt(colMap.name) : "";
      if (!name) continue;
      rows.push({
        isSection:false, sectionName:"",
        no:         colMap.no!==undefined       ? gt(colMap.no)         : "",
        name,
        unit:       colMap.unit!==undefined      ? gt(colMap.unit)       : "",
        readyQty:   colMap.readyQty!==undefined  ? gt(colMap.readyQty)   : "",
        wasteQty:   colMap.wasteQty!==undefined  ? gt(colMap.wasteQty)   : "",
        totalQty:   colMap.totalQty!==undefined  ? gt(colMap.totalQty)   : "",
        photoRaw:   colMap.photoRaw!==undefined  ? gp(colMap.photoRaw)   : "",
        photoSemi:  colMap.photoSemi!==undefined ? gp(colMap.photoSemi)  : "",
        importType: colMap.importType!==undefined? gt(colMap.importType) : "",
      });
    }
    if (rows.length>0) results.push({ title:`Jadval ${idx}`, rows });
  }
  return { tables: results, error: null };
}

// ─── Status styles ────────────────────────────────────────────────────────────

export const TP_STATUS_STYLE: Record<ProcessStatus,{bg:string;color:string;border:string}> = {
  [ProcessStatus.Pending]:    { bg:"var(--bg3)",         color:"var(--text2)",  border:"var(--border)" },
  [ProcessStatus.InProgress]: { bg:"var(--accent-dim)",  color:"var(--accent)", border:"rgba(26,110,235,0.25)" },
  [ProcessStatus.Approved]:   { bg:"var(--success-dim)", color:"var(--success)",border:"rgba(15,123,69,0.2)" },
  [ProcessStatus.Rejected]:   { bg:"var(--danger-dim)",  color:"var(--danger)", border:"var(--danger)" },
  [ProcessStatus.Completed]:  { bg:"var(--purple-dim)",  color:"var(--purple)", border:"rgba(109,74,173,0.2)" },
};

export const CN_STATUS_STYLE: Record<DrawingStatus,{bg:string;color:string;border:string}> = {
  [DrawingStatus.Draft]:      { bg:"var(--bg3)",         color:"var(--text2)",  border:"var(--border)" },
  [DrawingStatus.InProgress]: { bg:"var(--accent-dim)",  color:"var(--accent)", border:"rgba(26,110,235,0.25)" },
  [DrawingStatus.Approved]:   { bg:"var(--success-dim)", color:"var(--success)",border:"rgba(15,123,69,0.2)" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(d: string) {
  if (!d) return "—";
  const [y,m,day] = d.slice(0,10).split("-");
  if (!y||!m||!day) return "—";
  return `${day}-${m}-${y.slice(-2)}`;
}
