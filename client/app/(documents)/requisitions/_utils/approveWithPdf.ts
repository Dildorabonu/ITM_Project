import { requisitionService } from "@/lib/userService";
import { generateRequisitionPdfBlob, buildPdfFileName } from "./generateRequisitionPdf";

export interface ApproveWithPdfResult {
  pdfUploaded: boolean;
}

/**
 * Approves a requisition and appends a fresh PDF that includes the approval QR.
 * Older PDFs are kept untouched. PDF failure is non-fatal — approval is still committed.
 */
export async function approveWithPdf(reqId: string): Promise<ApproveWithPdfResult> {
  await requisitionService.approve(reqId);

  try {
    const updated = await requisitionService.getById(reqId);
    if (!updated) return { pdfUploaded: false };

    const blob = await generateRequisitionPdfBlob(updated);
    if (!blob) return { pdfUploaded: false };

    const fileName = buildPdfFileName(updated);
    const file = new File([blob], fileName, { type: "application/pdf" });
    await requisitionService.uploadFile(reqId, file, "approved");
    return { pdfUploaded: true };
  } catch {
    return { pdfUploaded: false };
  }
}
