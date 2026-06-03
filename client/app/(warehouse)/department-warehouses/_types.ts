import {
  DepartmentType,
  DEPARTMENT_TYPE_LABELS,
  ProductUnit,
  PRODUCT_UNIT_LABELS,
} from "@/lib/userService";

// Bo'lim omborlari sahifasi va uning [departmentId] tafsilot sahifasiga tegishli
// umumiy filter konstantalari va formatlash yordamchilari.

export const TYPE_FILTER_OPTIONS = [
  { id: String(DepartmentType.IshlabChiqarish), name: DEPARTMENT_TYPE_LABELS[DepartmentType.IshlabChiqarish] },
  { id: String(DepartmentType.Bolim),           name: DEPARTMENT_TYPE_LABELS[DepartmentType.Bolim] },
  { id: String(DepartmentType.Boshqaruv),       name: DEPARTMENT_TYPE_LABELS[DepartmentType.Boshqaruv] },
];

export const UNIT_FILTER_OPTIONS = (Object.keys(PRODUCT_UNIT_LABELS) as unknown as ProductUnit[]).map(k => ({
  id: String(k),
  name: PRODUCT_UNIT_LABELS[k],
}));

export interface TileColor {
  bg: string;
  soft: string;
}

// Build a stable color map for the full department set so that every visible
// tile receives a hue exactly 137.508° (golden angle) away from its neighbours.
// Hash-based mapping looks random in theory but suffers from the birthday
// paradox in practice — with only ~23 IDs spread over 360° clusters appear.
// Index-based golden-angle assignment guarantees maximum perceptual spacing.
export function buildColorMap(ids: string[], theme: "dark" | "light") {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, TileColor>();
  sorted.forEach((id, i) => {
    const hue = (i * 137.508) % 360;
    map.set(id, theme === "dark"
      ? {
          bg: `oklch(88% 0.075 ${hue})`,  // airy pastel — bottom-right
          soft: `oklch(93% 0.06 ${hue})`, // slightly lighter top-left
        }
      : {
          bg: `oklch(90% 0.07 ${hue})`,   // airy pastel — bottom-right
          soft: `oklch(94% 0.055 ${hue})`, // slightly lighter top-left
        });
  });
  return map;
}

export function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("uz-UZ");
}

export function fmtNum(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString("uz-UZ");
  return n.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });
}

export function fmtDateTime(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
