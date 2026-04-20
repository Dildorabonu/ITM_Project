import { ContractStatus, Priority, CONTRACT_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/userService";

// ─── Form type ────────────────────────────────────────────────────────────────

export interface ContractForm {
  contractNo: string;
  productType: string;
  quantity: string;
  unit: string;
  departmentIds: string[];
  startDate: string;
  endDate: string;
  priority: string;
  contractParty: string;
  notes: string;
}

export const emptyForm: ContractForm = {
  contractNo: "", productType: "", quantity: "", unit: "",
  departmentIds: [], startDate: "", endDate: "",
  priority: String(Priority.Medium), contractParty: "", notes: "",
};

// ─── Status / Priority styles ─────────────────────────────────────────────────

export const VISIBLE_STATUSES: ContractStatus[] = [
  ContractStatus.DrawingPending,
  ContractStatus.TechProcessing,
  ContractStatus.WarehouseCheck,
  ContractStatus.InProduction,
  ContractStatus.Completed,
];

export const STATUS_STYLE: Record<ContractStatus, { bg: string; color: string; border: string }> = {
  [ContractStatus.Draft]:                { bg: "var(--bg3)",         color: "var(--text2)",    border: "var(--border)" },
  [ContractStatus.DrawingPending]:       { bg: "#ede9fe",            color: "#6d28d9",         border: "#c4b5fd" },
  [ContractStatus.TechProcessing]:       { bg: "#fff7ed",            color: "#c2410c",         border: "#fdba74" },
  [ContractStatus.WarehouseCheck]:       { bg: "#fefce8",            color: "#a16207",         border: "#fde047" },
  [ContractStatus.InProduction]:         { bg: "#e6f4ea",            color: "#1e7e34",         border: "#a8d5b5" },
  [ContractStatus.Completed]:            { bg: "#e8f0fe",            color: "#1a56db",         border: "#a4c0f4" },
  [ContractStatus.Cancelled]:            { bg: "var(--danger-dim)",  color: "var(--danger)",   border: "var(--danger)" },
};

export const PRIORITY_STYLE: Record<Priority, { color: string }> = {
  [Priority.Low]:    { color: "var(--text2)" },
  [Priority.Medium]: { color: "#d97706" },
  [Priority.High]:   { color: "#dc2626" },
  [Priority.Urgent]: { color: "#7c3aed" },
};

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const WORKFLOW_STEPS: { status: ContractStatus; label: string; shortLabel: string }[] = [
  { status: ContractStatus.Draft,          label: "Shartnoma yaratilindi",                shortLabel: "Yaratildi" },
  { status: ContractStatus.DrawingPending, label: "Chizmasi tayyorlanmoqda",              shortLabel: "Chizma" },
  { status: ContractStatus.TechProcessing, label: "Texnologik jarayon tayyorlanmoqda",    shortLabel: "Tex jarayon" },
  { status: ContractStatus.WarehouseCheck, label: "Ombor tekshiruviga uzatildi",          shortLabel: "Ombor" },
  { status: ContractStatus.InProduction,   label: "Ishlab chiqarish jarayoni boshlangan", shortLabel: "Ishlab chiqarish" },
  { status: ContractStatus.Completed,      label: "Yakunlandi",                           shortLabel: "Yakunlandi" },
];

export const STEP_COLORS: Record<ContractStatus, { active: string; done: string; text: string }> = {
  [ContractStatus.Draft]:               { active: "#6b7280", done: "#6b7280", text: "#fff" },
  [ContractStatus.DrawingPending]:      { active: "#7c3aed", done: "#7c3aed", text: "#fff" },
  [ContractStatus.TechProcessing]:      { active: "#c2410c", done: "#c2410c", text: "#fff" },
  [ContractStatus.WarehouseCheck]:      { active: "#a16207", done: "#a16207", text: "#fff" },
  [ContractStatus.InProduction]:        { active: "#1e7e34", done: "#1e7e34", text: "#fff" },
  [ContractStatus.Completed]:           { active: "#1a56db", done: "#1a56db", text: "#fff" },
  [ContractStatus.Cancelled]:           { active: "#dc2626", done: "#dc2626", text: "#fff" },
};

// ─── Select options ───────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string; color?: string; icon?: string };

export const UNIT_OPTIONS: SelectOption[] = [
  { value: "",          label: "— Tanlang —" },
  { value: "Dona",      label: "Dona",          icon: "🔢" },
  { value: "Kilogramm", label: "Kilogramm",      icon: "⚖️" },
  { value: "Gramm",     label: "Gramm",          icon: "⚖️" },
  { value: "Litr",      label: "Litr",           icon: "💧" },
  { value: "Metr",      label: "Metr",           icon: "📏" },
  { value: "KvMetr",    label: "Kv. Metr (m²)", icon: "⬜" },
  { value: "KubMetr",   label: "Kub Metr (m³)", icon: "🧊" },
  { value: "Quti",      label: "Quti",           icon: "📦" },
  { value: "Paket",     label: "Paket",          icon: "🛍️" },
  { value: "Toʻplam",   label: "To'plam",        icon: "🗂️" },
];

export const PRIORITY_OPTIONS: SelectOption[] = [
  { value: String(Priority.Low),    label: "Past",        color: "var(--text2)" },
  { value: String(Priority.Medium), label: "O'rta",       color: "#d97706" },
  { value: String(Priority.High),   label: "Yuqori",      color: "#dc2626" },
  { value: String(Priority.Urgent), label: "Shoshilinch", color: "#7c3aed" },
];

export const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "Barcha holat" },
  ...VISIBLE_STATUSES.map(k => ({ value: String(k), label: CONTRACT_STATUS_LABELS[k], color: STATUS_STYLE[k].color })),
];

export const STATUS_CHANGE_OPTIONS: SelectOption[] = VISIBLE_STATUSES.map(k => ({
  value: String(k), label: CONTRACT_STATUS_LABELS[k], color: STATUS_STYLE[k].color,
}));
