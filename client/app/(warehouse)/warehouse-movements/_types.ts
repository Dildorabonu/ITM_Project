import type { StockMovementType } from "@/lib/stockMovements";
import { STOCK_MOVEMENT_COLOR, STOCK_MOVEMENT_LABEL } from "@/lib/stockMovements";

// Jurnal turlarining yagona manbasi — filtr dropdowni, jadvaldagi badge tooltipi
// va legend paneli (MovementTypeLegend) shu bitta massivdan oziqlanadi.
//
// `name` ATAYLAB tarjima qilinmaydi: jadvaldagi badge ham shu `STOCK_MOVEMENT_LABEL`
// lug'atidan (o'zbekcha) oziqlanadi, CheckSelect ham `name` ni xom holda
// chiqaradi. Legendda tarjima qilinsa, foydalanuvchi legenddagi nom bilan
// jadvaldagi badge'ni bir-biriga bog'lay olmay qoladi. `desc` esa sof UI matni —
// u `t()` orqali tarjima qilinadi.
export const STOCK_MOVEMENT_TYPE_OPTIONS: {
  id: StockMovementType;
  name: string;
  color: string;
  desc: string;
}[] = [
  {
    id: "In",
    name: STOCK_MOVEMENT_LABEL.In,
    color: STOCK_MOVEMENT_COLOR.In,
    desc: "Omborga yangi tovar keldi — xarid qabul qilindi",
  },
  {
    id: "Out",
    name: STOCK_MOVEMENT_LABEL.Out,
    color: STOCK_MOVEMENT_COLOR.Out,
    desc: "Tovar ombordan chiqib ketdi — bo'lim omboriga berildi",
  },
  {
    id: "Reserve",
    name: STOCK_MOVEMENT_LABEL.Reserve,
    color: STOCK_MOVEMENT_COLOR.Reserve,
    desc: "Talabnomaga band qilindi — tovar omborda turibdi, lekin boshqa talabnomaga berilmaydi",
  },
  {
    id: "Release",
    name: STOCK_MOVEMENT_LABEL.Release,
    color: STOCK_MOVEMENT_COLOR.Release,
    desc: "Band bekor qilindi — tovar bo'limga berildi yoki talabnoma rad etildi",
  },
  {
    id: "Adjust",
    name: STOCK_MOVEMENT_LABEL.Adjust,
    color: STOCK_MOVEMENT_COLOR.Adjust,
    desc: "Sanoq natijasi bo'yicha qo'lda tuzatildi — inventarizatsiya yoki yo'qotish",
  },
];

// Jadvaldagi badge tooltipi uchun tez qidiruv — yuqoridagi ro'yxatdan hosil qilinadi.
export const STOCK_MOVEMENT_DESC = Object.fromEntries(
  STOCK_MOVEMENT_TYPE_OPTIONS.map(o => [o.id, o.desc]),
) as Record<StockMovementType, string>;

// Jurnal ustidagi tur chiplari. "Band qilish" = Rezerv + Rezervdan chiqarish: ular ombordagi
// fizik harakat emas, Kirim/Chiqim yonidan yoziladigan band yozuvlari — alohida ikki chip
// foydalanuvchini chalkashtirardi.
export type MovementFilterId = "In" | "Out" | "Adjust" | "Booking";

export const MOVEMENT_FILTERS: {
  id: MovementFilterId;
  name: string;
  types: StockMovementType[];
  desc: string;
}[] = [
  { id: "In", name: STOCK_MOVEMENT_LABEL.In, types: ["In"], desc: STOCK_MOVEMENT_DESC.In },
  { id: "Out", name: STOCK_MOVEMENT_LABEL.Out, types: ["Out"], desc: STOCK_MOVEMENT_DESC.Out },
  { id: "Adjust", name: STOCK_MOVEMENT_LABEL.Adjust, types: ["Adjust"], desc: STOCK_MOVEMENT_DESC.Adjust },
  {
    id: "Booking",
    name: "Band qilish",
    types: ["Reserve", "Release"],
    desc: "Rezerv va Rezervdan chiqarish yozuvlari — tovar talabnomaga band qilinadi yoki band bekor qilinadi, ombordagi miqdor o'zgarmaydi",
  },
];

// Bitta amaldan jurnalda ikkita qator paydo bo'lishi — foydalanuvchini eng ko'p
// chalkashtiradigan joy. Legend panelining pastki blokida shular ko'rsatiladi.
export const STOCK_MOVEMENT_PAIRS: { action: string; types: StockMovementType[] }[] = [
  { action: "Omborga tovar keldi", types: ["In", "Reserve"] },
  { action: "Bo'limga berildi", types: ["Out", "Release"] },
];

// Kun guruhi sarlavhasi uchun oy nomlari — `t()` orqali tarjima qilinadi.
// Format ikkala tilda ham "5 avgust 2026" / "5 августа 2026" ko'rinishida ishlaydi,
// shuning uchun ruscha lug'atda oylar bosh kelishikda emas, qaratqichda beriladi.
export const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export const PAGE_SIZE = 50;
