import React from "react";
import { cookies } from "next/headers";
import AppShell from "@/app/_components/AppShell";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Ildiz layout — server komponenti sifatida qoladi, chunki faqat shu yerdan
 * route segment konfiguratsiyasini e'lon qilish mumkin.
 *
 * force-dynamic CSP uchun majburiy: middleware.ts har bir so'rovga alohida nonce
 * beradi va Next uni server render paytida inline skriptlarga qo'yadi. Sahifalar
 * build vaqtida statik prerender qilinsa, keshlangan HTML dagi skriptlarda nonce
 * bo'lmaydi va brauzer ularni bloklaydi.
 *
 * Butun interfeys (sidebar, topbar, tema, til) AppShell client komponentida.
 *
 * Tema cookie'dan o'qiladi: localStorage faqat brauzerda, effekt ishlagandan
 * keyin mavjud bo'ladi — shuning uchun SSR HTML doim kunduzgi chiqib, splash
 * animatsiyasi bir lahza oq ko'rinardi. Cookie server render paytida ham
 * o'qilgani uchun tungi rejim birinchi bo'yoqdanoq to'g'ri chiqadi.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialDark = (await cookies()).get(THEME_COOKIE)?.value === "dark";
  return <AppShell initialDark={initialDark}>{children}</AppShell>;
}
