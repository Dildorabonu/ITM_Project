import { NextRequest, NextResponse } from "next/server";

/**
 * Content-Security-Policy — har bir HTML javob uchun alohida nonce bilan.
 *
 * Next.js App Router hydration ma'lumotini inline <script> teglarida yuboradi,
 * shuning uchun script-src ni 'unsafe-inline' siz yopish uchun yagona yo'l —
 * so'rov boshiga nonce. Next so'rovning content-security-policy header'idan
 * nonce ni o'qib, o'zi chiqaradigan barcha skriptlarga qo'yadi; qolgan chunk'lar
 * 'strict-dynamic' orqali yuklanadi.
 *
 * Bosqichma-bosqich joriy qilish uchun CSP_REPORT_ONLY=true muhit o'zgaruvchisi
 * bilan siyosatni faqat kuzatuv (Report-Only) rejimida ishga tushirish mumkin —
 * buzilishlar konsolga tushadi, lekin hech narsa bloklanmaydi.
 */
const reportOnly = process.env.CSP_REPORT_ONLY === "true";
const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // dev rejimida Next/webpack source-map va HMR uchun eval ishlatadi
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Qabul qilingan istisno: Tailwind, React style={{...}} atributlari va
    // docx-preview <style> bloklari inline uslub ishlatadi — nonce ular uchun
    // qo'llanmaydi, shuning uchun style-src da 'unsafe-inline' qoladi.
    "style-src 'self' 'unsafe-inline'",
    // data: — SVG ikonalar va base64 rasmlar; blob: — PDF/docx preview
    "img-src 'self' data: blob:",
    // fonts.gstatic.com — globals.css dagi Sora (logo) shrifti uchun
    "font-src 'self' data: https://fonts.gstatic.com",
    // Backendga faqat Next.js rewrite orqali murojaat qilinadi — tashqi manzil kerak emas
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Diqqat: upgrade-insecure-requests ataylab qo'yilmagan — tizim hozircha HTTP
    // orqali ishlaydi (ichki HTTPS alohida vazifa), aks holda barcha so'rovlar
    // mavjud bo'lmagan https:// ga ko'chib, sayt ishlamay qoladi.
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Report-Only rejimida ham nonce injeksiyasi ishlashi uchun so'rov tomonida
  // har doim asosiy header nomi beriladi; rejim faqat javobda farq qiladi.
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    reportOnly ? "content-security-policy-report-only" : "content-security-policy",
    csp,
  );
  return response;
}

export const config = {
  matcher: [
    // Statik aktivlar, backendga proksilanadigan yo'llar va fayl yuklab olish
    // marshrutlari uchun CSP kerak emas — ular hujjat sifatida ochilmaydi.
    "/((?!api/|uploads/|fonts/|_next/static/|_next/image|favicon.ico).*)",
  ],
};
