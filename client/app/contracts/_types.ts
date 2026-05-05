import { ContractStatus, ContractProductStatus, Priority, CONTRACT_STATUS_LABELS, PRIORITY_LABELS, type UserLookup } from "@/lib/userService";

// ─── Form types ───────────────────────────────────────────────────────────────

export interface ContractProductForm {
  productType: string;
  quantity: string;
  unit: string;
  notes: string;
  departmentIds: string[];
  responsibleUsers: UserLookup[];
  supervisorUsers: UserLookup[];
  observerUsers: UserLookup[];
  pendingTzFiles: File[];
}

export const emptyProduct: ContractProductForm = {
  productType: "", quantity: "", unit: "", notes: "",
  departmentIds: [], responsibleUsers: [], supervisorUsers: [], observerUsers: [],
  pendingTzFiles: [],
};

export interface ContractForm {
  contractNo: string;
  startDate: string;
  endDate: string;
  priority: string;
  contractParty: string;
  notes: string;
  products: ContractProductForm[];
}

export const emptyForm: ContractForm = {
  contractNo: "",
  startDate: "", endDate: "",
  priority: String(Priority.Medium), contractParty: "", notes: "",
  products: [{ ...emptyProduct, departmentIds: [], responsibleUsers: [], supervisorUsers: [], observerUsers: [], pendingTzFiles: [] }],
};

// ─── Status / Priority styles ─────────────────────────────────────────────────

export const VISIBLE_STATUSES: ContractStatus[] = [
  ContractStatus.DrawingPending,
  ContractStatus.TechProcessing,
  ContractStatus.InProduction,
  ContractStatus.Completed,
];

export const STATUS_STYLE: Record<ContractStatus, { bg: string; color: string; border: string }> = {
  [ContractStatus.DrawingPending]:       { bg: "#ede9fe",            color: "#6d28d9",         border: "#c4b5fd" },
  [ContractStatus.TechProcessing]:       { bg: "#fff7ed",            color: "#c2410c",         border: "#fdba74" },
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
  { status: ContractStatus.DrawingPending, label: "Chizmasi tayyorlanmoqda",              shortLabel: "Chizma" },
  { status: ContractStatus.TechProcessing, label: "Texnologik jarayon tayyorlanmoqda",    shortLabel: "Tex jarayon" },
  { status: ContractStatus.InProduction,   label: "Ishlab chiqarish jarayoni boshlangan", shortLabel: "Ishlab chiqarish" },
  { status: ContractStatus.Completed,      label: "Yakunlandi",                           shortLabel: "Yakunlandi" },
];

export const STEP_COLORS: Record<ContractStatus, { active: string; done: string; text: string }> = {
  [ContractStatus.DrawingPending]:      { active: "#7c3aed", done: "#7c3aed", text: "#fff" },
  [ContractStatus.TechProcessing]:      { active: "#c2410c", done: "#c2410c", text: "#fff" },
  [ContractStatus.InProduction]:        { active: "#1e7e34", done: "#1e7e34", text: "#fff" },
  [ContractStatus.Completed]:           { active: "#1a56db", done: "#1a56db", text: "#fff" },
  [ContractStatus.Cancelled]:           { active: "#dc2626", done: "#dc2626", text: "#fff" },
};

// Per-product workflow mirrors the contract one but is keyed on ContractProductStatus.
// The shared shape lets WorkflowDiagram render either flow with the same component.
export const PRODUCT_WORKFLOW_STEPS: { status: ContractProductStatus; label: string; shortLabel: string }[] = [
  { status: ContractProductStatus.DrawingPending, label: "Chizmasi tayyorlanmoqda",              shortLabel: "Chizma" },
  { status: ContractProductStatus.TechProcessing, label: "Texnologik jarayon tayyorlanmoqda",    shortLabel: "Tex jarayon" },
  { status: ContractProductStatus.InProduction,   label: "Ishlab chiqarish jarayoni boshlangan", shortLabel: "Ishlab chiqarish" },
  { status: ContractProductStatus.Completed,      label: "Yakunlandi",                           shortLabel: "Yakunlandi" },
];

export const PRODUCT_STEP_COLORS: Record<ContractProductStatus, { active: string; done: string; text: string }> = {
  [ContractProductStatus.DrawingPending]: { active: "#7c3aed", done: "#7c3aed", text: "#fff" },
  [ContractProductStatus.TechProcessing]: { active: "#c2410c", done: "#c2410c", text: "#fff" },
  [ContractProductStatus.InProduction]:   { active: "#1e7e34", done: "#1e7e34", text: "#fff" },
  [ContractProductStatus.Completed]:      { active: "#1a56db", done: "#1a56db", text: "#fff" },
  [ContractProductStatus.Cancelled]:      { active: "#dc2626", done: "#dc2626", text: "#fff" },
};

export const PRODUCT_STATUS_STYLE: Record<ContractProductStatus, { bg: string; color: string; border: string }> = {
  [ContractProductStatus.DrawingPending]: { bg: "#ede9fe",            color: "#6d28d9",       border: "#c4b5fd" },
  [ContractProductStatus.TechProcessing]: { bg: "#fff7ed",            color: "#c2410c",       border: "#fdba74" },
  [ContractProductStatus.InProduction]:   { bg: "#e6f4ea",            color: "#1e7e34",       border: "#a8d5b5" },
  [ContractProductStatus.Completed]:      { bg: "#e8f0fe",            color: "#1a56db",       border: "#a4c0f4" },
  [ContractProductStatus.Cancelled]:      { bg: "var(--danger-dim)",  color: "var(--danger)", border: "var(--danger)" },
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
