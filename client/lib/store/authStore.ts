import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5223";

// .NET ClaimTypes long names
const CLAIM_NAME       = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";
const CLAIM_ROLE       = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const CLAIM_GIVEN_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname";
const CLAIM_SURNAME    = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname";

export interface User {
  id: string;
  login: string;
  role: string;
  firstName: string;
  lastName: string;
  permissions: string[];
}

interface AuthState {
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  login: (credentials: { login: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasModulePermission: (module: string) => boolean;
  isDirector: () => boolean;
}

function parseJwt(token: string): Record<string, unknown> | null {
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

function extractPermissions(payload: Record<string, unknown>): string[] {
  const raw = payload["perm"];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
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
          id: (payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string) || "",
          login: (payload?.[CLAIM_NAME] as string) || login,
          role: (payload?.[CLAIM_ROLE] as string) || "",
          firstName: (payload?.[CLAIM_GIVEN_NAME] as string) || "",
          lastName: (payload?.[CLAIM_SURNAME] as string) || "",
          permissions: payload ? extractPermissions(payload) : [],
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

      hasPermission: (permission: string) => {
        const { user } = get();
        return user?.permissions.includes(permission) ?? false;
      },

      hasModulePermission: (module: string) => {
        const { user } = get();
        return user?.permissions.some((p) => p.startsWith(`${module}.`)) ?? false;
      },

      isDirector: () => {
        const { user } = get();
        const r = (user?.role ?? "").toLowerCase();
        return r === "director" || r === "bosh direktor";
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
