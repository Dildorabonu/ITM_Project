// Energiya panelidagi raqamlarni formatlash va qurilma ranglari.
// Barcha ranglar CSS tokenlardan — dark/light rejimda o'zi moslashadi.

/** Ming ajratgichi sifatida oddiy bo'shliq (ru-RU U+00A0 yoki U+202F beradi). */
function group(value: number, decimals = 0): string {
  return value
    .toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/[\u00A0\u202F]/g, " ");
}

/** kWh: kichik qiymatda aniqroq, kattasida yaxlit. */
export function formatKwh(kwh: number): string {
  if (!Number.isFinite(kwh)) return "—";
  if (kwh === 0) return "0";
  if (Math.abs(kwh) < 10) return group(kwh, 2);
  if (Math.abs(kwh) < 100) return group(kwh, 1);
  return group(kwh, 0);
}

/** Pul: 1 mln dan oshsa qisqartiriladi ("1,41 mln"). */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${group(value / 1_000_000, 2)} mln`;
  return group(value, 0);
}

/** To'liq qiymat — `title` atributi uchun. */
export function formatMoneyFull(value: number | null | undefined, currency = "so'm"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${group(value, 0)} ${currency}`;
}

/** Quvvat: 1 kW dan oshsa kW da. Natija: [qiymat, birlik]. */
export function formatPower(watts: number | null | undefined): [string, string] {
  if (watts === null || watts === undefined || !Number.isFinite(watts)) return ["—", "W"];
  if (Math.abs(watts) >= 1000) return [group(watts / 1000, 1), "kW"];
  return [group(watts, 0), "W"];
}

export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${group(value, decimals)}%`;
}

/** Bucket kalitidan qisqa yorliq: "14:00" yoki "11-avg". */
const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

export function formatBucketLabel(bucket: string, kind: "hour" | "day"): string {
  if (kind === "hour") return bucket.slice(11, 16);

  const [, month, day] = bucket.split("-");
  const monthIndex = Number(month) - 1;
  return `${Number(day)}-${MONTHS_UZ[monthIndex] ?? month}`;
}

// ── Qurilma ranglari ────────────────────────────────────────────────────
// Palitra CSS tokenlardan. Rang qurilma nomining hash'i bo'yicha tayinlanadi.
// 14 ta qurilmagacha to'qnashuvlar bo'lmaydi; undan ortiq bo'lsa, ba'zi
// qurilmalar bir xil rangni qabul qilishi mumkin, lekin bitta grafikdagi
// ranglar tartibi har doim bir xil bo'ladi.

const DEVICE_PALETTE = [
  "var(--accent)",
  "var(--success)",
  "var(--purple)",
  "var(--warn)",
  "var(--accent3)",
  "var(--danger)",
  "var(--teal)",
  "var(--pink)",
  "var(--accent-light)",
  "var(--accent2)",
  "color-mix(in srgb, var(--accent) 60%, var(--success) 40%)",
  "color-mix(in srgb, var(--warn) 70%, var(--danger) 30%)",
  "color-mix(in srgb, var(--purple) 60%, var(--pink) 40%)",
  "color-mix(in srgb, var(--teal) 70%, var(--accent) 30%)",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Qurilma nomi → rang. Bir xil qurilma to'plami har doim bir xil ranglar
 * oladi, va to'plam tartibi rangni ta'sir qilmaydi (ichki sort qilinadi).
 * 14 qurilmagacha: to'qnashuvlar bo'lmaydi. Undan ortiq: forward-probe
 * orqali bo'sh slot qidiriladi, lekin bo'lishi mumkin bir nechta qurilma
 * bir xil rangni qabul qiladi.
 */
export function buildDeviceColorMap(names: string[]): Record<string, string> {
  const used = new Set<number>();
  const map: Record<string, string> = {};

  for (const name of [...names].sort()) {
    let slot = hash(name) % DEVICE_PALETTE.length;

    for (let i = 0; i < DEVICE_PALETTE.length && used.has(slot); i++) {
      slot = (slot + 1) % DEVICE_PALETTE.length;
    }

    used.add(slot);
    map[name] = DEVICE_PALETTE[slot];
  }

  return map;
}
