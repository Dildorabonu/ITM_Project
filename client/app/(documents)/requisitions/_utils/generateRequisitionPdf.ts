import {
  RequisitionSource,
  type RequisitionResponse,
  type RequisitionItemResponse,
} from "@/lib/userService";
import { getApiBase } from "@/lib/apiBase";
import { fmtDecimal } from "@/lib/num";

// ─── A4 geometry (print sahifasi bilan bir xil) ───────────────────────────────
// 96dpi: 1mm ≈ 3.78px
const A4_W = 794;                // 210mm
const A4_H = 1123;               // 297mm
const PAD_TOP = 45;              // 12mm
const PAD_BOTTOM = 45;           // 12mm
const PAD_LEFT = 57;             // 15mm
const PAD_RIGHT = 57;            // 15mm
const CONTENT_H = A4_H - PAD_TOP - PAD_BOTTOM; // 1033

// Bin-packing safety buffers
const PAGE_BOTTOM_PAD = 40;       // pastki marjnga yopishmaslik uchun nafas
const FOOTER_BUFFER = 16;
const FALLBACK_HEADER_H = 150;
const FALLBACK_FOOTER_H = 150;
const FALLBACK_THEAD_H = 46;
const FALLBACK_ROW_H = 90;

// Ustun kengliklari foiz bo'yicha — print/page.tsx blank bilan bir xil
const COL_WIDTHS = [6, 23, 11, 9, 24, 12, 15];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePhoto(url?: string | null): string {
  if (!url) return "";
  if (/^(blob:|data:|https?:)/i.test(url)) return url;
  if (url.startsWith("/")) return getApiBase() + url;
  return url;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Items'dagi photo URL'larini base64 data URL'ga aylantiradi (CORS muammosini chetlab o'tish uchun)
async function inlinePhotos(items: RequisitionItemResponse[]): Promise<RequisitionItemResponse[]> {
  return Promise.all(items.map(async it => {
    const src = resolvePhoto(it.freeTextPhoto);
    if (!src || /^(data:|blob:)/i.test(src)) return it;
    const dataUrl = await fetchAsDataUrl(src);
    return dataUrl ? { ...it, freeTextPhoto: dataUrl } : { ...it, freeTextPhoto: undefined };
  }));
}

function formatSignDate(req: RequisitionResponse): string {
  if (req.signDate) return req.signDate;
  try {
    return formatDateDdMmYyyy(new Date(req.createdAt));
  } catch {
    return "";
  }
}

function formatDateDdMmYyyy(dt: Date): string {
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatIsoToDdMmYyyy(iso?: string | null): string {
  if (!iso) return "";
  try { return formatDateDdMmYyyy(new Date(iso)); }
  catch { return ""; }
}

function formatQuantity(q: number | string): string {
  if (q == null) return "";
  // fmtDecimal float "quyruqlari"ni ham kesadi: 53.99999999999999 → "54".
  return fmtDecimal(q);
}

function buildIntroText(req: RequisitionResponse): string {
  const purpose = escapeHtml(req.purpose || "");
  const action = req.source === RequisitionSource.Purchase
    ? "сотиб олиниши"
    : "омбордан берилиши";
  const purposeHtml = purpose
    ? `<span style="border-bottom:1px solid #999;padding:0 4px;">${purpose}</span>`
    : "";
  return `Ушбу оркали Сиздан, ${purposeHtml} ${action} учун рухсат беришингизни сўрайман.`;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHeaderHtml(req: RequisitionResponse): string {
  return `
    <div data-section="header">
      <div style="text-align:center;margin-bottom:4px;">
        <div style="font-weight:700;font-size:14px;font-family:'Times New Roman',serif;">
          &quot;INNOVATSIYA TEXNOLOGIYALARI MARKAZI&quot; MChJ
        </div>
      </div>
      <div style="text-align:center;margin-bottom:2px;font-size:13px;">Бош директорига</div>
      <div style="text-align:center;font-weight:700;font-size:18px;letter-spacing:1px;margin:12px 0 18px;font-family:'Times New Roman',serif;">
        ТАЛАБНОМА
      </div>
      <div style="font-size:13px;line-height:1.8;margin-bottom:20px;font-family:'Times New Roman',serif;">
        ${buildIntroText(req)}
      </div>
    </div>`;
}

function buildColgroupHtml(): string {
  return COL_WIDTHS.map(w => `<col style="width:${w}%;" />`).join("");
}

function buildTableHeadHtml(): string {
  const th = `padding:7px 8px;border:1px solid #5a3f00;font-weight:700;font-size:11px;text-align:center;line-height:1.35;font-family:'Times New Roman',serif;color:#fff;background:#b8860b;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  return `
    <tr>
      <th style="${th}">№</th>
      <th style="${th}">Махсулот номи<br /><span style="font-weight:400;font-size:10px;">(рус тилида кўрсатилган)</span></th>
      <th style="${th}">Ўлчов<br />бирлиги</th>
      <th style="${th}">Миқдори</th>
      <th style="${th}">Техник кўрсаткичи<br /><span style="font-weight:400;font-size:10px;">(рус тилида кўрсатилди)</span></th>
      <th style="${th}">Фотосурати</th>
      <th style="${th}">Изох</th>
    </tr>`;
}

function buildItemRow(item: RequisitionItemResponse, index: number): string {
  const photoSrc = resolvePhoto(item.freeTextPhoto);
  const photoCell = photoSrc
    ? `<img src="${photoSrc}" alt="расм" style="max-width:100%;max-height:72px;object-fit:contain;display:block;margin:0 auto;" />`
    : "";

  const td = `padding:5px 7px;border:1px solid #ccc;vertical-align:top;font-family:'Times New Roman',serif;font-size:12px;color:#000;line-height:1.5;word-break:break-word;`;
  const tdCenter = td + "text-align:center;";

  return `
    <tr>
      <td style="${tdCenter}font-weight:600;">${index + 1}.</td>
      <td style="${td}">${escapeHtml(item.materialName || "")}</td>
      <td style="${tdCenter}">${escapeHtml(item.unit || "")}</td>
      <td style="${tdCenter}">${escapeHtml(formatQuantity(item.quantity))}</td>
      <td style="${td}">${escapeHtml(item.freeTextSpec || "")}</td>
      <td style="${tdCenter}padding:6px;vertical-align:middle;">${photoCell}</td>
      <td style="${td}">${escapeHtml(item.notes || "")}</td>
    </tr>`;
}

function buildSignatureBlock(opts: {
  label: string;
  name: string;
  date: string;
  qrBase64?: string | null;
}): string {
  const qrHtml = opts.qrBase64
    ? `<img src="data:image/png;base64,${opts.qrBase64}" alt="QR" style="width:64px;height:64px;display:block;image-rendering:pixelated;" />`
    : `<div style="width:64px;height:64px;border:1px dashed #bbb;"></div>`;

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px dashed #ccc;font-family:'Times New Roman',serif;">
      ${qrHtml}
      <div style="flex:1;font-size:12px;line-height:1.5;">
        <div style="font-weight:700;text-transform:uppercase;font-size:11px;color:#333;letter-spacing:0.3px;">${escapeHtml(opts.label)}</div>
        <div style="margin-top:2px;font-size:13px;color:#000;">${escapeHtml(opts.name || "—")}</div>
        <div style="margin-top:2px;font-size:11px;color:#555;">${escapeHtml(opts.date)}</div>
      </div>
    </div>`;
}

function buildFooterHtml(req: RequisitionResponse): string {
  const signDate = formatSignDate(req);
  const signerTitle = escapeHtml(req.signerTitle || "");
  const signerName = escapeHtml(req.signerName || "");

  const warehouseBlock = req.warehouseCheckQrCodeData
    ? buildSignatureBlock({
        label: "Омборчи имзоси",
        name: req.warehouseCheckedByName || "",
        date: formatIsoToDdMmYyyy(req.warehouseCheckedAt),
        qrBase64: req.warehouseCheckQrCodeData,
      })
    : "";

  const approverBlock = req.qrCodeData
    ? buildSignatureBlock({
        label: "Тасдиқлаган (Бош директор)",
        name: req.approvedByName || "",
        date: formatIsoToDdMmYyyy(req.approvedAt),
        qrBase64: req.qrCodeData,
      })
    : "";

  const signaturesWrapper = warehouseBlock || approverBlock
    ? `<div style="margin-top:18px;">${warehouseBlock}${approverBlock}</div>`
    : "";

  return `
    <div data-section="footer">
      <div style="display:flex;gap:40px;align-items:flex-start;margin-top:16px;font-family:'Times New Roman',serif;">
        <div style="flex:1;border-bottom:1px solid #999;padding:2px 4px;text-transform:uppercase;font-weight:700;font-size:12px;min-height:20px;">
          ${signerTitle}
        </div>
        <div style="flex:1;border-bottom:1px solid #999;padding:2px 4px;font-size:13px;min-height:20px;">
          ${signerName}
        </div>
      </div>
      <div style="margin-top:10px;display:flex;align-items:baseline;gap:4px;font-family:'Times New Roman',serif;">
        <span style="display:inline-block;border-bottom:1px solid #999;min-width:110px;max-width:110px;font-size:12px;padding-bottom:2px;padding-left:2px;">
          ${escapeHtml(signDate)}
        </span>
        <span style="font-size:12px;white-space:nowrap;">йил</span>
      </div>
      ${signaturesWrapper}
    </div>`;
}

// ─── Page sheet (A4 fixed-height container) ───────────────────────────────────

function buildPageSheet(opts: {
  req: RequisitionResponse;
  items: RequisitionItemResponse[];
  startIndex: number;
  isFirst: boolean;
  isLast: boolean;
}): string {
  const { req, items, startIndex, isFirst, isLast } = opts;

  const headerHtml = isFirst ? buildHeaderHtml(req) : "";
  const footerHtml = isLast ? buildFooterHtml(req) : "";
  const rowsHtml = items.map((it, i) => buildItemRow(it, startIndex + i)).join("");

  // page-break-after:always inline + sheet height (1123px) sal kattaroq A4
  // page'idan (~1122.5px) — bu juftlik html2pdf da har sheet'dan keyin
  // bo'sh "zigzag" sahifa yaratardi. Print/page.tsx blank kabi: faqat
  // page-break-inside:avoid qo'yib, html2pdf'ning `avoid: .page-sheet`
  // konfiguratsiyasi tabiiy paginatsiyani amalga oshirsin.
  return `
    <div class="page-sheet" style="
      width:${A4_W}px;
      height:${A4_H}px;
      min-height:${A4_H}px;
      padding:${PAD_TOP}px ${PAD_RIGHT}px ${PAD_BOTTOM}px ${PAD_LEFT}px;
      box-sizing:border-box;
      background:#fff;
      color:#000;
      font-family:'Times New Roman',serif;
      font-size:13px;
      overflow:hidden;
      page-break-inside:avoid;
      break-inside:avoid;
      flex-shrink:0;
    ">
      ${headerHtml}
      <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;font-family:'Times New Roman',serif;">
        <colgroup>${buildColgroupHtml()}</colgroup>
        <thead>${buildTableHeadHtml()}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${footerHtml}
    </div>`;
}

// ─── Probe + bin-packing ──────────────────────────────────────────────────────

interface PageMeasurements {
  headerH: number;
  footerH: number;
  theadH: number;
  rowHs: number[];
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(img => new Promise<void>(res => {
      if (img.complete && img.naturalWidth > 0) return res();
      const done = () => res();
      img.addEventListener("load",  done, { once: true });
      img.addEventListener("error", done, { once: true });
    })),
  );
}

async function measure(
  hostWrapper: HTMLElement,
  req: RequisitionResponse,
  items: RequisitionItemResponse[],
): Promise<PageMeasurements> {
  // Hammasini bitta tabiiy oqim ichida render qilamiz va o'lchaymiz.
  // page-sheet ichidagi bilan bir xil padding va col widths ishlatiladi —
  // shunda keyinchalik chunklab joylashtirganda balandliklar mos keladi.
  const probeHtml = `
    <div id="probe-doc" style="
      width:${A4_W}px;
      padding:${PAD_TOP}px ${PAD_RIGHT}px ${PAD_BOTTOM}px ${PAD_LEFT}px;
      box-sizing:border-box;
      background:#fff;color:#000;
      font-family:'Times New Roman',serif;font-size:13px;
    ">
      <div id="probe-header">${buildHeaderHtml(req)}</div>
      <table id="probe-table" style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;font-family:'Times New Roman',serif;">
        <colgroup>${buildColgroupHtml()}</colgroup>
        <thead id="probe-thead">${buildTableHeadHtml()}</thead>
        <tbody id="probe-tbody">
          ${items.map((it, i) => buildItemRow(it, i)).join("")}
        </tbody>
      </table>
      <div id="probe-footer">${buildFooterHtml(req)}</div>
    </div>
  `;
  hostWrapper.innerHTML = probeHtml;

  // Layout va imagelar to'liq render bo'lishini kutamiz
  await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())));
  await waitForImages(hostWrapper);

  const headerEl = hostWrapper.querySelector("#probe-header") as HTMLElement | null;
  const theadEl = hostWrapper.querySelector("#probe-thead") as HTMLElement | null;
  const footerEl = hostWrapper.querySelector("#probe-footer") as HTMLElement | null;
  const rowEls = Array.from(hostWrapper.querySelectorAll("#probe-tbody > tr")) as HTMLElement[];

  return {
    headerH: headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : FALLBACK_HEADER_H,
    theadH: theadEl ? Math.ceil(theadEl.getBoundingClientRect().height) : FALLBACK_THEAD_H,
    footerH: footerEl ? Math.ceil(footerEl.getBoundingClientRect().height) : FALLBACK_FOOTER_H,
    rowHs: rowEls.map(el => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      return h > 0 ? h : FALLBACK_ROW_H;
    }),
  };
}

function planPages(itemCount: number, m: PageMeasurements): number[][] {
  // O'lchamlarga asoslanib, qatorlarni A4 page'larga taqsimlaymiz.
  // First page'da header bor; last page'da footer bor.
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;

  for (let i = 0; i < itemCount; i++) {
    const isFirstPage = pages.length === 0;
    const isLastRow = i === itemCount - 1;
    const overhead = (isFirstPage ? m.headerH : 0) + m.theadH;
    const footer = isLastRow ? m.footerH + FOOTER_BUFFER : 0;
    const available = Math.max(100, CONTENT_H - overhead - footer - PAGE_BOTTOM_PAD);
    const rowH = m.rowHs[i] ?? FALLBACK_ROW_H;

    if (used + rowH > available && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(i);
    used += rowH;
  }
  if (current.length || pages.length === 0) pages.push(current);
  return pages;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// html2pdf chunk'i bir marta yuklanadi va keyingi chaqiruvlarda keshdan olinadi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let html2pdfPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadHtml2Pdf(): Promise<any> {
  if (!html2pdfPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2pdfPromise = import("html2pdf.js" as any)
      .then(m => m.default)
      .catch(err => { html2pdfPromise = null; throw err; });
  }
  return html2pdfPromise;
}

// Chunk'ni oldindan (fon rejimida) yuklab qo'yish uchun — PDF kerak bo'lganda
// modul kutish vaqti (1-2s) jarayondan tushib qoladi.
export function preloadPdfEngine(): void {
  loadHtml2Pdf().catch(() => { /* generatsiya vaqtida qayta urinadi */ });
}

export async function generateRequisitionPdfBlob(req: RequisitionResponse): Promise<Blob | null> {
  // Engine yuklanishi rasm inline qilish va probe render bilan parallel ketadi.
  const enginePromise = loadHtml2Pdf();
  const items = await inlinePhotos(req.items);
  const reqWithInlined: RequisitionResponse = { ...req, items };

  // Wrapper foydalanuvchidan yashiringan, lekin docEl ichida tabiiy block oqimda joylashadi —
  // html2pdf clone qilganda layout buzilmasligi uchun docEl o'zi position transformatsiyasiz turadi.
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.cssText = `position:fixed;top:0;left:-${A4_W + 200}px;width:${A4_W}px;background:#fff;pointer-events:none;`;
  document.body.appendChild(wrapper);

  try {
    // 1-bosqich: O'lchovlar uchun probe render
    const measurements = await measure(wrapper, reqWithInlined, items);

    // Edge case: items bo'sh — kamida bitta sahifa kerak (header + footer)
    const itemCount = items.length;
    const pageBins: number[][] = itemCount === 0
      ? [[]]
      : planPages(itemCount, measurements);

    // 2-bosqich: Page-sheet'larni ketma-ket joylab, html2pdf uchun yakuniy DOM yasaymiz
    const sheetsHtml = pageBins.map((bin, pi) => buildPageSheet({
      req: reqWithInlined,
      items: bin.map(i => items[i]),
      startIndex: bin[0] ?? 0,
      isFirst: pi === 0,
      isLast: pi === pageBins.length - 1,
    })).join("");

    wrapper.innerHTML = `
      <div class="generating-pdf" style="display:block;width:${A4_W}px;background:#fff;">
        ${sheetsHtml}
      </div>
    `;
    const docEl = wrapper.firstElementChild as HTMLElement | null;
    if (!docEl) return null;

    // Layout va rasmlarni yana kutamiz (page-sheet ichida qayta render bo'ldi)
    await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    await waitForImages(docEl);

    const html2pdf = await enginePromise;
    const blob: Blob = await html2pdf()
      .set({
        margin: 0,
        pagebreak: { mode: ["css"], avoid: ".page-sheet" },
        // scale 1.5 → A4 varaq ~1191px kenglikda (~144 DPI): matn bir xil
        // o'qiladi, lekin canvas maydoni scale 2 ga nisbatan 44% ga kichrayadi.
        // quality 0.85 fayl hajmini ~3 barobar kamaytiradi — serverga yuklash
        // ham tezlashadi. print/page.tsx dagi konfiguratsiya bilan bir xil.
        image: { type: "jpeg", quality: 0.85 },
        // imageTimeout — yuklanmagan remote rasmda html2canvas default 15
        // soniya kutadi va butun jarayon osilib qoladi.
        html2canvas: { scale: 1.5, useCORS: true, imageTimeout: 3000, width: A4_W, windowWidth: A4_W },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(docEl)
      .toPdf()
      .output("blob");
    if (!blob || blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  } finally {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }
}

export function buildPdfFileName(req: RequisitionResponse): string {
  // Child talabnomada parent raqamiga + source-ga qarab nom beriladi —
  // bitta ota-talabnoma ichidagi 3 PDF (parent + ombordan + sotib) bir-biridan
  // farqli, lekin tushunarli nomlar bilan saqlanadi.
  const parentNo = req.parentRequisitionNo || req.requisitionNo || "talabnoma";
  const safeNo = parentNo.replace(/[^A-Za-z0-9_-]+/g, "_");

  let suffix = "";
  if (req.source === RequisitionSource.Warehouse) suffix = "_ombordan_olishga";
  else if (req.source === RequisitionSource.Purchase) suffix = "_sotib_olishga";

  return `talabnoma_${safeNo}${suffix}.pdf`;
}
