"use client";

import { useEffect, useState } from "react";
import { useConnectionStore, ConnectionStatus } from "@/lib/store/connectionStore";
import { useT } from "@/lib/i18n";

const EXIT_MS = 380;

export default function ConnectionBanner() {
  const t = useT();
  const status = useConnectionStore((s) => s.status);
  const checking = useConnectionStore((s) => s.checking);
  const nextRetryAt = useConnectionStore((s) => s.nextRetryAt);
  const retryDelayMs = useConnectionStore((s) => s.retryDelayMs);
  const retryNow = useConnectionStore((s) => s.retryNow);

  // "online" ga qaytganda banner darhol yo'qolmaydi — chiqish animatsiyasi
  // tugaguncha oxirgi ko'ringan holatini saqlab turamiz.
  const [shown, setShown] = useState<ConnectionStatus>("online");
  if (status !== "online" && status !== shown) setShown(status);
  const leaving = status === "online" && shown !== "online";

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onOffline = () => useConnectionStore.getState().goOffline();
    const onOnline = () => useConnectionStore.getState().retryNow();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShown("online"), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (nextRetryAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [nextRetryAt]);

  if (shown === "online") return null;

  const restored = shown === "restored";
  const secondsLeft =
    nextRetryAt === null
      ? 0
      : Math.min(Math.ceil(retryDelayMs / 1000), Math.max(0, Math.ceil((nextRetryAt - now) / 1000)));

  return (
    <div
      role="status"
      aria-live="polite"
      className={`conn-banner${restored ? " is-restored" : ""}${leaving ? " is-leaving" : ""}`}
    >
      <div className="conn-icon">
        {restored ? (
          <svg className="conn-check" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className="conn-dot" />
        )}
      </div>

      <div key={restored ? "restored" : "offline"} className="conn-text">
        <div className="conn-title">
          {restored ? t("Aloqa tiklandi") : t("Server bilan aloqa uzildi")}
        </div>
        <div className="conn-sub">
          {restored ? (
            t("Ishni davom ettirishingiz mumkin")
          ) : checking ? (
            t("Ulanilmoqda…")
          ) : (
            <>
              {t("Qayta ulanish")}: <span className="conn-count">{secondsLeft} {t("s")}</span>
            </>
          )}
        </div>
      </div>

      {!restored && (
        <button
          type="button"
          className="conn-retry"
          onClick={retryNow}
          disabled={checking}
          aria-label={t("Qayta urinish")}
        >
          <svg
            className={checking ? "is-spinning" : undefined}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span className="conn-retry-label">{t("Qayta urinish")}</span>
        </button>
      )}

      {!restored && nextRetryAt !== null && (
        <span
          key={nextRetryAt}
          className="conn-progress"
          style={{ animationDuration: `${retryDelayMs}ms` }}
        />
      )}
    </div>
  );
}
