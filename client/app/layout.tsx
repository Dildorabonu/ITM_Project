import React from "react";
import AppShell from "@/app/_components/AppShell";

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
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
