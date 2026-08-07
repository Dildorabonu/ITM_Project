import { RequisitionSource } from "./userService";

// Bo'lingan (child) talabnoma raqamiga backend til-neytral suffiks qo'shadi:
// "-W" = Warehouse (ombordan), "-P" = Purchase (xarid). DB'da shu kod saqlanadi —
// unga hech qanday tilga bog'liq matn yozilmaydi, chunki bazadagi qiymat barcha
// tillar uchun bitta. Foydalanuvchiga esa kod emas, i18n orqali tarjima qilingan
// matn ko'rsatiladi (RequisitionNo komponenti).

export const REQUISITION_SOURCE_SHORT_LABEL: Record<RequisitionSource, string> = {
  [RequisitionSource.Warehouse]: "Ombordan",
  [RequisitionSource.Purchase]: "Xarid",
};

/** Talabnoma raqamini asosiy qism va manba suffiksiga ajratadi. */
export function splitRequisitionNo(no: string): { base: string; source: RequisitionSource | null } {
  if (no.endsWith("-W")) return { base: no.slice(0, -2), source: RequisitionSource.Warehouse };
  if (no.endsWith("-P")) return { base: no.slice(0, -2), source: RequisitionSource.Purchase };
  return { base: no, source: null };
}

/** Suffiksiz raqam — manba yonidagi badge orqali allaqachon ko'rinib turgan joylar uchun. */
export function requisitionNoBase(no: string): string {
  return splitRequisitionNo(no).base;
}
