import axios, { AxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5223";

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
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// CSRF token: read non-httpOnly XSRF-TOKEN cookie and mirror it in X-CSRF-Token
// header on every state-changing request (Double-Submit Cookie pattern).
api.interceptors.request.use((config) => {
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
        `${API_URL}/api/auth/refresh`,
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
