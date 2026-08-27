/**
 * Tema (kunduzgi/tungi) saqlash joyi.
 *
 * localStorage manba bo'lib qoladi — appearance sahifasi va AppShell o'shani
 * o'qiydi. Lekin localStorage server render paytida mavjud emas, shuning uchun
 * xuddi shu qiymat cookie'ga ham yoziladi: ildiz layout uni o'qib SSR HTML ni
 * darhol to'g'ri temada chiqaradi va sahifa yangilanganda oq "yaltirash"
 * (FOUC) bo'lmaydi.
 */
export const THEME_COOKIE = "itm_theme";

export type ThemeValue = "dark" | "light";

/** Cookie'ni bir yilga yozadi. Faqat brauzerda chaqiriladi. */
export function writeThemeCookie(theme: ThemeValue) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}
