import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5223";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("itm_auth");
      if (raw) {
        const { state } = JSON.parse(raw);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

// Refresh lock — prevents multiple concurrent refresh calls
let refreshPromise: Promise<string> | null = null;

function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const raw = localStorage.getItem("itm_auth");
      if (!raw) throw new Error("no token");
      const stored = JSON.parse(raw);
      const refreshToken = stored?.state?.refreshToken;
      if (!refreshToken) throw new Error("no refresh token");

      const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = res.data.result ?? res.data;

      stored.state.accessToken = accessToken;
      stored.state.refreshToken = newRefreshToken;
      localStorage.setItem("itm_auth", JSON.stringify(stored));

      return accessToken as string;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// On 401, attempt token refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const accessToken = await doRefresh();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem("itm_auth");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
