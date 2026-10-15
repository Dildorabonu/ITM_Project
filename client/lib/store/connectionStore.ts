import axios from "axios";
import { create } from "zustand";
import { getApiBase } from "@/lib/apiBase";

export type ConnectionStatus = "online" | "offline" | "restored";

const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000];
const RESTORED_VISIBLE_MS = 2200;
const PROBE_TIMEOUT_MS = 5000;
const MIN_CHECKING_MS = 700;

type ConnectionStore = {
  status: ConnectionStatus;
  checking: boolean;
  nextRetryAt: number | null;
  retryDelayMs: number;
  suspect: () => Promise<void>;
  goOffline: () => void;
  retryNow: () => void;
  markOnline: () => void;
};

// Backend'ning o'z 5xx javoblari doim `errors` bilan keladi (GlobalExceptionHandler).
// `errors`siz 5xx — Next.js proxy yoki tunnel backend'ga yeta olmagani.
export function isConnectionLoss(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.code === "ERR_CANCELED") return false;
  const res = error.response;
  if (!res) return true;
  return res.status >= 500 && !Array.isArray(res.data?.errors);
}

// api instance emas, oddiy axios — aks holda interceptor tekshiruvning o'zini
// yana "shubhali" deb qayd qiladi.
async function probe(): Promise<boolean> {
  try {
    await axios.get(`${getApiBase()}/api/license/status`, {
      timeout: PROBE_TIMEOUT_MS,
      withCredentials: true,
    });
    return true;
  } catch (e) {
    return !isConnectionLoss(e);
  }
}

let inflight: Promise<boolean> | null = null;
function probeOnce(): Promise<boolean> {
  inflight ??= probe().finally(() => {
    inflight = null;
  });
  return inflight;
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let restoredTimer: ReturnType<typeof setTimeout> | null = null;
let failedAttempts = 0;

function clearTimers() {
  if (retryTimer) clearTimeout(retryTimer);
  if (restoredTimer) clearTimeout(restoredTimer);
  retryTimer = restoredTimer = null;
}

export function waitForConnection(): Promise<void> {
  return new Promise((resolve) => {
    if (useConnectionStore.getState().status !== "offline") return resolve();
    const unsubscribe = useConnectionStore.subscribe((s) => {
      if (s.status === "offline") return;
      unsubscribe();
      resolve();
    });
  });
}

export const useConnectionStore = create<ConnectionStore>((set, get) => {
  function scheduleRetry() {
    const delay = RETRY_DELAYS_MS[Math.min(failedAttempts, RETRY_DELAYS_MS.length - 1)];
    set({ nextRetryAt: Date.now() + delay, retryDelayMs: delay });
    retryTimer = setTimeout(check, delay);
  }

  function enterOffline() {
    clearTimers();
    failedAttempts = 0;
    set({ status: "offline", checking: false });
    scheduleRetry();
  }

  function restore() {
    clearTimers();
    set({ status: "restored", checking: false, nextRetryAt: null });
    restoredTimer = setTimeout(() => {
      if (get().status === "restored") set({ status: "online" });
    }, RESTORED_VISIBLE_MS);
  }

  async function check() {
    if (get().checking) return;
    clearTimers();
    set({ checking: true, nextRetryAt: null });
    // Server o'chiq bo'lsa proxy bir zumda rad etadi — kutilmasa "Ulanilmoqda"
    // holati ko'zga ilinmay, "Qayta urinish" bosilmagandek tuyuladi.
    const [ok] = await Promise.all([
      probeOnce(),
      new Promise((resolve) => setTimeout(resolve, MIN_CHECKING_MS)),
    ]);
    // Kutish paytida boshqa so'rov muvaffaqiyatli o'tib, aloqani tiklagan bo'lishi mumkin.
    if (get().status !== "offline") return;
    if (ok) {
      restore();
    } else {
      failedAttempts++;
      set({ checking: false });
      scheduleRetry();
    }
  }

  return {
    status: "online",
    checking: false,
    nextRetryAt: null,
    retryDelayMs: RETRY_DELAYS_MS[0],

    suspect: async () => {
      if (get().status === "offline") return;
      const ok = await probeOnce();
      if (!ok && get().status !== "offline") enterOffline();
    },

    goOffline: () => {
      if (get().status !== "offline") enterOffline();
    },

    retryNow: () => {
      if (get().status === "offline") void check();
    },

    markOnline: () => {
      if (get().status === "offline") restore();
    },
  };
});
