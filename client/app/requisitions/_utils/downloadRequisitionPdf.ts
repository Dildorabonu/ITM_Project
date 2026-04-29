import { requisitionService } from "@/lib/userService";
import { generateRequisitionPdfBlob, buildPdfFileName } from "./generateRequisitionPdf";

async function fetchAndBuildPdf(id: string): Promise<{ blob: Blob; fileName: string } | null> {
  const req = await requisitionService.getById(id);
  if (!req) return null;
  const blob = await generateRequisitionPdfBlob(req);
  if (!blob) return null;
  return { blob, fileName: buildPdfFileName(req) };
}

export async function downloadRequisitionPdf(id: string): Promise<boolean> {
  const data = await fetchAndBuildPdf(id);
  if (!data) return false;
  const url = URL.createObjectURL(data.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

export type OpenPdfResult = "ok" | "blocked" | "error";

export async function openRequisitionPdfInNewTab(id: string): Promise<OpenPdfResult> {
  const data = await fetchAndBuildPdf(id);
  if (!data) return "error";
  const url = URL.createObjectURL(data.blob);
  const tab = window.open("", "_blank");
  if (!tab) {
    URL.revokeObjectURL(url);
    return "blocked";
  }
  tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "ok";
}
