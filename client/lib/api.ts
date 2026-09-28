import axios, { AxiosRequestConfig } from "axios";
import { getApiBase } from "@/lib/apiBase";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-CSRF-Token";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = name + "=";
  for (const part of document.cookie.split(";")) {
    const c = part.trim();
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
  }
  return null;
}

export const api = axios.create({
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Har bir so'rovda baseURL'ni qayta hisoblaymiz — foydalanuvchi qaysi host orqali
// kirgan bo'lsa (localhost, LAN IP, va h.k.) backend ham o'sha host'ga ketadi.
// Bu same-site cookie tartibini saqlash uchun majburiy.
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();

  // CSRF token: read non-httpOnly XSRF-TOKEN cookie and mirror it in X-CSRF-Token
  // header on every state-changing request (Double-Submit Cookie pattern).
  const method = (config.method || "get").toLowerCase();
  if (method !== "get" && method !== "head" && method !== "options") {
    const csrf = getCookie(CSRF_COOKIE);
    if (csrf) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)[CSRF_HEADER] = csrf;
    }
  }
  return config;
});

// Refresh lock — prevents multiple concurrent refresh calls
let refreshPromise: Promise<void> | null = null;

function doRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // Refresh token cookie auto-sends with credentials; backend rotates cookies in the response.
      await axios.post(
        `${getApiBase()}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// On 401, attempt token refresh once, then retry the original request.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: (AxiosRequestConfig & { _retry?: boolean; url?: string }) | undefined = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    // Litsenziya bloki: backend 403 + X-License-Status header qaytaradi. Butun
    // ilovani bloklovchi ekranni (LicenseGate) ishga tushiramiz.
    if (status === 403) {
      const licenseFlag =
        error.response?.headers?.["x-license-status"] || error.response?.data?.licenseExpired;
      if (licenseFlag && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("license-expired", {
            detail: { reason: error.response?.data?.reason },
          })
        );
      }
    }

    // Don't try to refresh on the refresh/login endpoints themselves
    const isAuthEndpoint = url.includes("/api/auth/refresh") || url.includes("/api/auth/login");

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await doRefresh();
        return api(original);
      } catch {
        if (typeof window !== "undefined") {
          // Clear persisted user hint and bounce to login
          try { localStorage.removeItem("itm_auth"); } catch { /* noop */ }
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Backend ApiResult xato matnini oladi — topilmasa `fallback` qaytariladi. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
  return msg ?? fallback;
}
