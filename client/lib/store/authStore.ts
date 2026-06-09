import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";
import { api } from "@/lib/api";
import { getApiBase } from "@/lib/apiBase";

export interface User {
  login: string;
  role: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  departmentId: string | null;
}

interface AuthState {
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  user: User | null;
  login: (credentials: { login: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasModulePermission: (module: string) => boolean;
}

interface AuthUserResponse {
  login: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId: string | null;
  permissions: string[];
}

function toUser(dto: AuthUserResponse): User {
  return {
    login: dto.login,
    role: dto.role ?? "",
    firstName: dto.firstName ?? "",
    lastName: dto.lastName ?? "",
    permissions: Array.isArray(dto.permissions) ? dto.permissions : [],
    departmentId: dto.departmentId ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      user: null,

      login: async ({ login, password }) => {
        // withCredentials so the server-set httpOnly auth cookies are stored by the browser
        const res = await axios.post(
          `${getApiBase()}/api/auth/login`,
          { login, password },
          { withCredentials: true }
        );
        const dto: AuthUserResponse = res.data.result;
        set({ user: toUser(dto) });
      },

      logout: async () => {
        try {
          await api.post("/api/auth/logout");
        } catch {
          // ignore — server may have already invalidated the session
        }
        set({ user: null });
      },

      refreshMe: async () => {
        try {
          const res = await api.get("/api/auth/me");
          const dto: AuthUserResponse = res.data.result;
          set({ user: toUser(dto) });
        } catch {
          set({ user: null });
        }
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        return user?.permissions.includes(permission) ?? false;
      },

      hasModulePermission: (module: string) => {
        const { user } = get();
        return user?.permissions.some((p) => p.startsWith(`${module}.`)) ?? false;
      },
    }),
    {
      name: "itm_auth",
      // Persist only the user object as a hint that the user is signed in. The actual
      // session lives in httpOnly cookies on the server; on a stale cookie the API
      // client's 401 interceptor will refresh or bounce to /login.
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
