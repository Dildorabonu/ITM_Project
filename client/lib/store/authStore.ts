import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:7270";

// .NET ClaimTypes long names
const CLAIM_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";
const CLAIM_ROLE = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

export interface User {
  id: string;
  login: string;
  role: string;
}

interface AuthState {
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  login: (credentials: { login: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

function parseJwt(token: string): Record<string, string> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      accessToken: null,
      refreshToken: null,
      user: null,

      login: async ({ login, password }) => {
        const res = await axios.post(`${API_URL}/api/auth/login`, {
          login,
          password,
        });
        const { accessToken, refreshToken } = res.data.result;
        const payload = parseJwt(accessToken);
        const user: User = {
          id: payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || "",
          login: payload?.[CLAIM_NAME] || login,
          role: payload?.[CLAIM_ROLE] || "",
        };
        set({ accessToken, refreshToken, user });
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await axios.post(`${API_URL}/api/auth/revoke`, { refreshToken });
          } catch {
            // ignore revoke errors
          }
        }
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: "itm_auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
