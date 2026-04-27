import { requisitionService } from "@/lib/userService";
import { generateRequisitionPdfBlob, buildPdfFileName } from "./generateRequisitionPdf";

export interface SplitWithPdfResult {
  childIds: string[];
  pdfFailures: number;
}

/**
 * Splits a parent requisition and generates a "talabnoma" PDF for each child,
 * uploading it as an attachment. PDF generation failures are non-fatal —
 * the children are still created in the DB.
 */
export async function splitWithPdfs(parentId: string): Promise<SplitWithPdfResult> {
  const childIds = await requisitionService.split(parentId);
  if (childIds.length === 0) return { childIds, pdfFailures: 0 };

  // Sequential — bir vaqtda ikki render bir-biriga xalal bermasligi uchun
  let pdfFailures = 0;
  for (const childId of childIds) {
    try {
      const child = await requisitionService.getById(childId);
      if (!child) { pdfFailures++; continue; }

      const blob = await generateRequisitionPdfBlob(child);
      if (!blob) { pdfFailures++; continue; }

      const file = new File([blob], buildPdfFileName(child), { type: "application/pdf" });
      await requisitionService.uploadFile(childId, file, "pdf");
    } catch {
      pdfFailures++;
    }
  }

  return { childIds, pdfFailures };
}
