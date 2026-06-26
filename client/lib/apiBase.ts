// Backend API base URL'ini aniqlash.
//
// Override: agar NEXT_PUBLIC_API_URL env var o'rnatilgan bo'lsa (frontend va
// backend alohida server'larda bo'lsa), o'sha qiymat ishlatiladi.
//
// Odatda: bo'sh string qaytariladi — Axios nisbiy URL ishlatadi va Next.js
// rewrites orqali /api/* so'rovlari localhost:5223 ga yo'naltiriladi.
export function getApiBase(): string {
  const override = process.env.NEXT_PUBLIC_API_URL;
  if (override && override.length > 0) return override;
  return "";
}
