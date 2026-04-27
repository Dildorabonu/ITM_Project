import {
  RequisitionSource,
  type RequisitionResponse,
  type RequisitionItemResponse,
} from "@/lib/userService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5223";

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
  if (url.startsWith("/")) return API_URL + url;
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
  // Fallback: use createdAt → DD.MM.YYYY
  try {
    const dt = new Date(req.createdAt);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  } catch {
    return "";
  }
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

// ─── Row HTML ──────────────────────────────────────────────────────────────────

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

function formatQuantity(q: number | string): string {
  if (q == null) return "";
  const s = String(q);
  return s.endsWith(".0") || s.endsWith(",0") ? s.slice(0, -2) : s;
}

// ─── Document HTML ─────────────────────────────────────────────────────────────

function buildHtml(req: RequisitionResponse): string {
  const th = `padding:5px 6px;border:1px solid #a0720a;font-weight:700;font-size:11px;text-align:center;line-height:1.3;font-family:'Times New Roman',serif;color:#fff;`;
  const introHtml = buildIntroText(req);
  const rowsHtml = req.items.map((it, i) => buildItemRow(it, i)).join("");
  const signDate = formatSignDate(req);
  const signerTitle = escapeHtml(req.signerTitle || "");
  const signerName = escapeHtml(req.signerName || "");

  return `
    <div style="background:#fff;color:#000;font-family:'Times New Roman',serif;font-size:13px;padding:28px 36px;width:794px;box-sizing:border-box;">
      <div style="text-align:center;margin-bottom:4px;">
        <div style="font-weight:700;font-size:14px;font-family:'Times New Roman',serif;">
          &quot;INNOVATSIYA TEXNOLOGIYALARI MARKAZI&quot; MChJ
        </div>
      </div>
      <div style="text-align:center;margin-bottom:2px;font-size:13px;">Бош директорига</div>
      <div style="text-align:center;font-weight:700;font-size:18px;letter-spacing:1px;margin:12px 0 18px;font-family:'Times New Roman',serif;">
        ТАЛАБНОМА
      </div>
      <div style="font-size:13px;line-height:1.8;margin-bottom:6px;text-align:right;color:#444;font-family:'Times New Roman',serif;">
        № ${escapeHtml(req.requisitionNo)}
      </div>
      <div style="font-size:13px;line-height:1.8;margin-bottom:20px;font-family:'Times New Roman',serif;">
        ${introHtml}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;table-layout:fixed;font-family:'Times New Roman',serif;">
        <colgroup>
          <col style="width:4%;" />
          <col style="width:24%;" />
          <col style="width:10%;" />
          <col style="width:10%;" />
          <col style="width:30%;" />
          <col style="width:10%;" />
          <col style="width:12%;" />
        </colgroup>
        <thead>
          <tr style="background:#b8860b;color:#fff;">
            <th style="${th}">№</th>
            <th style="${th}">Махсулот номи<br /><span style="font-weight:400;font-size:10px;">(рус тилида кўрсатилган)</span></th>
            <th style="${th}">Ўлчов<br />бирлиги</th>
            <th style="${th}">Миқдори</th>
            <th style="${th}">Техник кўрсаткичи<br /><span style="font-weight:400;font-size:10px;">(рус тилида кўрсатилди)</span></th>
            <th style="${th}">Фотосурати</th>
            <th style="${th}">Изох</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
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
    </div>
  `;
}

// ─── PDF generator ─────────────────────────────────────────────────────────────

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

export async function generateRequisitionPdfBlob(req: RequisitionResponse): Promise<Blob | null> {
  // Photolarni base64 data URL'ga aylantiramiz — CORS muammosi bo'lmasligi uchun
  const items = await inlinePhotos(req.items);
  const reqWithInlined: RequisitionResponse = { ...req, items };

  // docEl normal flow'da bo'lishi kerak — html2pdf ichki overlay'ga clone qiladi,
  // agar manba `position:absolute` bo'lsa clone'ning layout'i buziladi va PDF bo'sh chiqadi.
  // Shuning uchun foydalanuvchidan yashirish uchun tashqi wrapper'ni offscreen joylaymiz,
  // docEl o'zi esa hech qanday position transformatsiyasiz ichida tabiiy ravishda joylashadi.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-100000px;top:0;width:794px;background:#fff;pointer-events:none;";
  wrapper.innerHTML = buildHtml(reqWithInlined);
  const docEl = wrapper.firstElementChild as HTMLElement | null;
  if (!docEl) return null;
  document.body.appendChild(wrapper);

  try {
    // Layout va imagelar to'liq render bo'lishini kutamiz (2 frame xavfsizroq)
    await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    await waitForImages(docEl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (await import("html2pdf.js" as any)).default;
    const blob: Blob = await html2pdf()
      .set({
        margin: 0,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, width: 794 },
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
  const safeNo = (req.requisitionNo || "talabnoma").replace(/[^A-Za-z0-9_-]+/g, "_");
  return `talabnoma_${safeNo}.pdf`;
}
