/**
 * O'nlik sonlar bilan **aniq** ishlash uchun yordamchilar — hech qayerda
 * yaxlitlash yo'q.
 *
 * JavaScript'da `0.018 * 3000` → `53.99999999999999` beradi, chunki 0.018 ikkilik
 * float'da aniq saqlanmaydi. Yechim — sonni "±raqamlar / 10^scale" ko'rinishida
 * ajratib, butun sonlar ustida ko'paytirish va nuqtani qayta qo'yish. Natija
 * matematik jihatdan aniq: 18 × 3000 = 54000, scale 3 → "54".
 */

/** Qiymat = (neg ? -1 : 1) × digits / 10^scale */
type Dec = { neg: boolean; digits: string; scale: number };

const DEC_RE = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/** "0.018" → { digits: "18", scale: 3 }. O'qib bo'lmasa yoki juda uzun bo'lsa null. */
function parseDec(value: number | string): Dec | null {
  const s = String(value).trim().replace(",", ".");
  const m = DEC_RE.exec(s);
  if (!m) return null;

  const sign = m[1];
  const intPart = m[2] ?? "";
  const fracPart = m[3] ?? "";
  if (!intPart && !fracPart) return null;

  let digits = `${intPart}${fracPart}`;
  let scale = fracPart.length - (m[4] ? parseInt(m[4], 10) : 0);

  // Manfiy scale — son butun qismga qarab siljigan (1e3): nol qo'shib tekislaymiz.
  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }
  digits = digits.replace(/^0+(?=\d)/, "");

  // Butun sonlar ustidagi ko'paytirish Number bilan bajariladi — xavfsiz
  // butun son chegarasidan chiqadigan qiymatlarni qabul qilmaymiz.
  if (!Number.isSafeInteger(Number(digits))) return null;

  return { neg: sign === "-", digits, scale };
}

/** Ortiqcha nollarni kesadi — yaxlitlamaydi: "54.000" → "54", "0.0180" → "0.018". */
function stripZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

function composeDec(neg: boolean, digits: string, scale: number): string {
  let s: string;
  if (scale === 0) {
    s = digits;
  } else {
    const p = digits.padStart(scale + 1, "0");
    s = `${p.slice(0, p.length - scale)}.${p.slice(p.length - scale)}`;
  }
  s = stripZeros(s);
  return neg && Number(s) !== 0 ? `-${s}` : s;
}

/**
 * Ikki o'nlik sonni **aniq** ko'paytiradi va natijani o'nlik satr sifatida
 * qaytaradi: `mulDecimalStr("0.018", 3000) === "54"`.
 * Qiymatlarni o'qib bo'lmasa yoki aniqlik chegarasidan chiqsa `null` qaytaradi —
 * chaqiruvchi o'zi qaror qiladi (yaxlitlab qo'ymaymiz).
 */
export function mulDecimalStr(a: number | string, b: number | string): string | null {
  const da = parseDec(a);
  const db = parseDec(b);
  if (!da || !db) return null;

  const product = Number(da.digits) * Number(db.digits);
  if (!Number.isSafeInteger(product)) return null;

  return composeDec(da.neg !== db.neg, String(product), da.scale + db.scale);
}

/**
 * Sonni ko'rsatish uchun kanonik o'nlik satrga o'giradi — **yaxlitlamaydi**,
 * faqat ortiqcha nollarni va eksponent yozuvni tozalaydi:
 * `54.000` → `"54"`, `1e-5` → `"0.00001"`, `12.3456789` → `"12.3456789"`.
 */
export function fmtDecimal(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = parseDec(value);
  if (!d) return String(value);
  return composeDec(d.neg, d.digits, d.scale);
}

/**
 * `value × (1 + percent / 100)` ni **aniq** hisoblaydi: `addPercentStr("75", 3) === "77.25"`.
 * Foiz bazis punktga (1/100 %) aylantiriladi — 2 xonali kasrgacha aniq.
 */
export function addPercentStr(value: number | string, percent: number): string | null {
  const scaled = mulDecimalStr(value, 10000 + Math.round(percent * 100));
  return scaled === null ? null : mulDecimalStr(scaled, "0.0001");
}

/** O'nlik satrni yuqoriga butun songa yaxlitlaydi: `"14.42"` → `"15"`, `"1030"` → `"1030"`. */
export function ceilDecimalStr(value: number | string): string | null {
  const d = parseDec(value);
  if (!d) return null;
  const [int, frac = ""] = composeDec(false, d.digits, d.scale).split(".");
  if (d.neg) return int === "0" ? "0" : `-${int}`;
  return /[1-9]/.test(frac) ? String(Number(int) + 1) : int;
}
