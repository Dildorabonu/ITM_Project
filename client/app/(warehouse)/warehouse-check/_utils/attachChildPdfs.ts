import { requisitionService, type RequisitionResponse } from "@/lib/userService";

// Ombor tekshiruvi natijasida yaratilgan har bir bola talabnoma uchun PDF generatsiya
// qilib, talabnomaga biriktiradi. Muvaffaqiyatsiz PDF'lar sonini qaytaradi.
//
// Vaqt taqsimoti: bola talabnomalarni o'qish va PDF'ni serverga yuklash — tarmoq,
// html2canvas renderi — asosiy oqim (CPU). Shu sababli tarmoq qismlari parallel
// bajariladi, renderlar esa ketma-ket: ikki render bir vaqtda ishlaganda ular
// baribir bitta oqimda navbat kutadi, ustiga bir-birining o'lchov (probe)
// layoutiga xalal berishi mumkin.
export async function attachChildPdfs(childIds: string[]): Promise<number> {
  if (childIds.length === 0) return 0;

  // Engine chunk'i va bola talabnomalar bir vaqtda yuklanadi.
  const modPromise = import("@/app/(documents)/requisitions/_utils/generateRequisitionPdf");
  const children = await Promise.all(
    childIds.map(id => requisitionService.getById(id).catch(() => null)),
  );
  const { generateRequisitionPdfBlob, buildPdfFileName } = await modPromise;

  let failures = 0;
  // Upload'lar render bilan bir vaqtda ketadi — keyingi PDF renderi oldingisining
  // tarmoqqa yuklanishini kutmaydi.
  const uploads: Promise<unknown>[] = [];

  for (const child of children as (RequisitionResponse | null)[]) {
    if (!child) { failures++; continue; }
    try {
      const blob = await generateRequisitionPdfBlob(child);
      if (!blob) { failures++; continue; }
      const file = new File([blob], buildPdfFileName(child), { type: "application/pdf" });
      uploads.push(
        requisitionService.uploadFile(child.id, file, "pdf").catch(() => { failures++; }),
      );
    } catch {
      failures++;
    }
  }

  await Promise.all(uploads);
  return failures;
}
