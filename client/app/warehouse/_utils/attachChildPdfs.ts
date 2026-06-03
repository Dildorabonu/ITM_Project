import { requisitionService } from "@/lib/userService";

// Ombor tekshiruvi natijasida yaratilgan har bir bola talabnoma uchun PDF generatsiya
// qilib, talabnomaga biriktiradi. Ketma-ket bajariladi — bir vaqtda ikki render
// bir-biriga xalal bermasligi uchun. Muvaffaqiyatsiz PDF'lar sonini qaytaradi.
export async function attachChildPdfs(childIds: string[]): Promise<number> {
  if (childIds.length === 0) return 0;
  const { generateRequisitionPdfBlob, buildPdfFileName } =
    await import("../../requisitions/_utils/generateRequisitionPdf");

  let failures = 0;
  for (const childId of childIds) {
    try {
      const child = await requisitionService.getById(childId);
      if (!child) { failures++; continue; }
      const blob = await generateRequisitionPdfBlob(child);
      if (!blob) { failures++; continue; }
      const file = new File([blob], buildPdfFileName(child), { type: "application/pdf" });
      await requisitionService.uploadFile(childId, file, "pdf");
    } catch {
      failures++;
    }
  }
  return failures;
}
