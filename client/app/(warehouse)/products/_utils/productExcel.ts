import * as XLSX from "xlsx";
import {
  ProductUnit,
  PRODUCT_UNIT_LABELS,
  type DepartmentOption,
} from "@/lib/userService";
import type { ParsedImportRow } from "../_types";

// Mahsulotlarni ommaviy import qilish uchun Excel namuna faylini yaratib yuklab beradi.
// 3 ta varaq: Mahsulotlar (to'ldirish uchun), Bo'limlar va O'lchov birliklari (ma'lumotnoma).
export function downloadProductsTemplate(departments: DepartmentOption[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Products template
  const headers = ["Mahsulot nomi *", "Invoice raqami *", "Bo'lim nomi *", "Miqdor", "O'lchov birligi", "Tavsif"];
  const example = [
    "Printer qog'ozi",
    "INV-2026-0001",
    departments[0]?.name ?? "Bo'lim nomini kiriting",
    "100",
    "Dona",
    "A4 formatdagi qog'oz",
  ];
  const ws = XLSX.utils.aoa_to_sheet([
    ["Ko'rsatma: * belgisi bilan belgilangan ustunlar majburiy. Invoice raqami unikal bo'lishi shart. Maksimal 200 ta mahsulot. 3-qatordan boshlab ma'lumot kiriting."],
    headers,
    example,
  ]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 32 }];
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
}

export interface ParseProductsResult {
  rows: ParsedImportRow[];
  errors: string[];
}

// Yuklangan Excel faylni o'qib, import preview qatorlariga aylantiradi.
// Qatorlardagi format/bo'lim/dublikat xatolari `errors` maydonida belgilanadi.
// Bazadagi dublikat/o'xshashlik tekshiruvi alohida (backend) amalga oshiriladi.
export function parseProductsExcel(
  file: File,
  departments: DepartmentOption[],
): Promise<ParseProductsResult> {
  return new Promise(resolve => {
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
          resolve({ rows: [], errors: ["Faylda ma'lumot topilmadi. 3-qatordan boshlab mahsulotlarni kiriting."] });
          return;
        }
        if (dataRows.length > 200) {
          resolve({ rows: [], errors: [`Faylda ${dataRows.length} ta qator bor. Maksimal: 200 ta mahsulot.`] });
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
          const [name, invoiceNumber, deptName, qty, unitLabel, desc] = cols;
          const errors: string[] = [];

          if (!name) errors.push("Mahsulot nomi kiritilmagan");
          if (!invoiceNumber) errors.push("Invoice raqami kiritilmagan");
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
            invoiceNumber: invoiceNumber ?? "",
            departmentName: deptName ?? "",
            departmentId: dept?.id,
            quantity: isNaN(quantity) ? 0 : quantity,
            unit,
            description: desc ?? "",
            errors,
          };
        });

        // Mark duplicate invoice numbers within the imported file
        const invCounts = new Map<string, number>();
        for (const r of parsed) {
          const k = r.invoiceNumber.trim().toLowerCase();
          if (k) invCounts.set(k, (invCounts.get(k) ?? 0) + 1);
        }
        for (const r of parsed) {
          const k = r.invoiceNumber.trim().toLowerCase();
          if (k && (invCounts.get(k) ?? 0) > 1) {
            r.errors.push(`Invoice raqami "${r.invoiceNumber}" faylda takrorlangan`);
          }
        }

        resolve({ rows: parsed, errors: [] });
      } catch {
        resolve({ rows: [], errors: ["Faylni o'qishda xatolik. Excel formatini tekshiring."] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
