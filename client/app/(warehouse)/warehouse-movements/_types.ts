import type { StockMovementType } from "@/lib/stockMovements";
import { STOCK_MOVEMENT_COLOR } from "@/lib/stockMovements";

// Jurnal turlarining yagona manbasi — filtr dropdowni, jadvaldagi badge tooltipi
// va legend paneli (MovementTypeLegend) shu bitta massivdan oziqlanadi.
//
// `name` ATAYLAB tarjima qilinmaydi: jadvaldagi badge backenddan kelgan
// `typeLabel` ni ko'rsatadi (o'zbekcha), CheckSelect ham `name` ni xom holda
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
    name: "Kirim",
    color: STOCK_MOVEMENT_COLOR.In,
    desc: "Omborga yangi tovar keldi — xarid qabul qilindi",
  },
  {
    id: "Out",
    name: "Chiqim",
    color: STOCK_MOVEMENT_COLOR.Out,
    desc: "Tovar ombordan butunlay chiqdi — sarflandi yoki hisobdan chiqarildi",
  },
  {
    id: "Transfer",
    name: "Ko'chirish",
    color: STOCK_MOVEMENT_COLOR.Transfer,
    desc: "Markaziy ombordan bo'lim omboriga o'tkazildi — korxonadagi umumiy miqdor kamaymaydi",
  },
  {
    id: "Reserve",
    name: "Rezerv",
    color: STOCK_MOVEMENT_COLOR.Reserve,
    desc: "Talabnomaga band qilindi — tovar omborda turibdi, lekin boshqa talabnomaga berilmaydi",
  },
  {
    id: "Release",
    name: "Rezervdan chiqarish",
    color: STOCK_MOVEMENT_COLOR.Release,
    desc: "Band bekor qilindi — tovar bo'limga berildi yoki talabnoma rad etildi",
  },
  {
    id: "Adjust",
    name: "Tuzatish",
    color: STOCK_MOVEMENT_COLOR.Adjust,
    desc: "Sanoq natijasi bo'yicha qo'lda tuzatildi — inventarizatsiya yoki yo'qotish",
  },
];

// Jadvaldagi badge tooltipi uchun tez qidiruv — yuqoridagi ro'yxatdan hosil qilinadi.
export const STOCK_MOVEMENT_DESC = Object.fromEntries(
  STOCK_MOVEMENT_TYPE_OPTIONS.map(o => [o.id, o.desc]),
) as Record<StockMovementType, string>;

// Bitta amaldan jurnalda ikkita qator paydo bo'lishi — foydalanuvchini eng ko'p
// chalkashtiradigan joy. Legend panelining pastki blokida shular ko'rsatiladi.
export const STOCK_MOVEMENT_PAIRS: { action: string; types: StockMovementType[] }[] = [
  { action: "Omborga tovar keldi", types: ["In", "Reserve"] },
  { action: "Bo'limga berildi", types: ["Transfer", "Release"] },
];

// Kun guruhi sarlavhasi uchun oy nomlari — `t()` orqali tarjima qilinadi.
// Format ikkala tilda ham "5 avgust 2026" / "5 августа 2026" ko'rinishida ishlaydi,
// shuning uchun ruscha lug'atda oylar bosh kelishikda emas, qaratqichda beriladi.
export const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export const PAGE_SIZE = 50;
