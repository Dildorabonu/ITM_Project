import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { ru } from "./ru";

export type Lang = "uz" | "ru";

const STORAGE_KEY = "appearance_lang";

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "uz";
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "ru" ? "ru" : "uz";
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: readInitialLang(),
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.setAttribute("lang", lang);
    }
    set({ lang });
  },
}));

/**
 * Berilgan o'zbekcha (manba) satrni joriy tilga tarjima qiladi.
 * Rus tili tanlangan bo'lsa lug'atdan oladi, topilmasa o'zbekcha qoladi (fallback).
 */
export function translate(lang: Lang, text: string): string {
  if (lang !== "ru") return text;
  return ru[text] ?? text;
}

/**
 * Komponentlarda ishlatish uchun tarjima hook'i.
 *   const t = useT();
 *   <span>{t("Shartnomalar")}</span>
 * Til o'zgarganda hook qaytargan komponent avtomatik qayta render bo'ladi.
 */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  // SSR va birinchi klient renderda har doim o'zbekcha (manba) qaytaramiz —
  // bu server bilan klient HTML mosligini (hydration) buzmaslik uchun.
  // Mount bo'lgandan keyin tanlangan tilga o'tamiz.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Stabil referensiya: faqat lang yoki mounted o'zgarganda yangilanadi.
  // Aks holda har renderda yangi funksiya bo'lib, uni effect/useCallback
  // dependency'siga qo'ygan komponentlarda cheksiz qayta-ishlash (loop) yuzaga keladi.
  return useCallback(
    (text: string) => (mounted ? translate(lang, text) : text),
    [lang, mounted]
  );
}
