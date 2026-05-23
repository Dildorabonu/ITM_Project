// Backend API base URL'ini aniqlash. Brauzerda — hozirgi sahifa hostname'idan
// foydalanadi, shunda foydalanuvchi qaysi host orqali kirsa, API ham o'sha host'ga
// ketadi (same-site cookie'lar uchun majburiy).
//
// Override: agar NEXT_PUBLIC_API_URL env var o'rnatilgan bo'lsa (masalan, frontend
// va backend alohida server'larda bo'lsa), o'sha qiymat ishlatiladi.
export function getApiBase(): string {
  const override = process.env.NEXT_PUBLIC_API_URL;
  if (override && override.length > 0) return override;

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5223`;
  }

  // SSR fallback — bu yo'l deyarli ishlamaydi (auth client-side)
  return "http://localhost:5223";
}
