import { useEffect, useRef } from "react";

/**
 * Sahifadan ketilganda forma ma'lumotlarini sessionStorage'ga saqlaydi.
 * Qaytib kelganda avtomatik tiklaydi.
 *
 * @param key       - Noyob kalit (masalan: "draft_products")
 * @param isActive  - Forma ochiq va create rejimida bo'lsa true
 * @param data      - Saqlanadigan forma ma'lumotlari
 * @param onRestore - Mount'da draft topilsa chaqiriladi; forma ochilishi va ma'lumot tiklanishi kerak
 */
export function useDraft<T>(
  key: string,
  isActive: boolean,
  data: T,
  onRestore: (data: T) => void,
): void {
  const mountedRef = useRef(false);
  const restoringRef = useRef(false);

  // Mount'da bir marta draft tiklash
  useEffect(() => {
    mountedRef.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        restoringRef.current = true;
        onRestore(JSON.parse(raw) as T);
      }
    } catch {
      sessionStorage.removeItem(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // isActive yoki data o'zgarganda saqlash/o'chirish
  useEffect(() => {
    if (!mountedRef.current) return;
    // Restore holatida forma hali re-render bo'lmagan bo'lishi mumkin — skip
    if (restoringRef.current && !isActive) return;
    restoringRef.current = false;

    if (isActive) {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // sessionStorage to'liq bo'lishi mumkin, e'tibor bermaslik
      }
    } else {
      sessionStorage.removeItem(key);
    }
  }, [key, isActive, data]);
}
