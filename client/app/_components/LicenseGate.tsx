"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

type LicenseInfo = {
  valid: boolean;
  reason: string;
  message: string;
  customer?: string | null;
  expiresUtc?: string | null;
};

/**
 * Litsenziya bloklanganda butun ilova ustidan to'liq blok ekranini ko'rsatadi.
 * Ikki manbadan ishga tushadi:
 *   1) mount'da /api/license/status ni tekshiradi;
 *   2) har qanday API 403 (X-License-Status) da api.ts "license-expired" hodisasini yuboradi.
 */
export default function LicenseGate() {
  const t = useT();
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [blocked, setBlocked] = useState(false);

  // Admin faollashtirish formasi (bloklangan holatda ham ishlaydi).
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await api.post("/api/license/activate", { token: token.trim(), secret });
      const data = res.data?.result as LicenseInfo | undefined;
      if (data?.valid) {
        setBlocked(false);
        setInfo(data);
        setToken("");
        setSecret("");
        setShowForm(false);
      } else {
        setFormError(data?.message || t("Litsenziya faollashmadi."));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { errors?: string[] } } };
      setFormError(err.response?.data?.errors?.[0] || t("Faollashtirishda xatolik."));
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    try {
      const res = await api.get("/api/license/status");
      const data = res.data?.result as LicenseInfo | undefined;
      if (data) {
        setInfo(data);
        setBlocked(!data.valid);
      }
    } catch {
      /* status endpoint ochiq — xato bo'lsa bloklamaymiz, keyingi so'rov aniqlaydi */
    }
  }

  useEffect(() => {
    check();

    const onExpired = () => {
      setBlocked(true);
      check();
    };
    window.addEventListener("license-expired", onExpired);

    // Har 2 daqiqada qayta tekshirib turamiz (muddat ish jarayonida tugashi mumkin).
    const iv = setInterval(check, 120_000);

    return () => {
      window.removeEventListener("license-expired", onExpired);
      clearInterval(iv);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!blocked) return null;

  const expired = info?.reason === "EXPIRED";
  const tamper = info?.reason === "TAMPER";
  const machine = info?.reason === "MACHINE";
  const trialExpired = info?.reason === "TRIAL_EXPIRED";

  const title = tamper
    ? t("Tizim vaqti buzilgan")
    : machine
    ? t("Litsenziya bu serverga tegishli emas")
    : trialExpired
    ? t("Bepul sinov muddati tugadi")
    : expired
    ? t("Litsenziya muddati tugadi")
    : t("Litsenziya faol emas");

  const expiresText = info?.expiresUtc
    ? new Date(info.expiresUtc).toLocaleDateString("uz-UZ", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(6, 9, 15, 0.92)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="[animation:panel-appear_0.28s_ease]"
        style={{
          maxWidth: 460,
          width: "100%",
          background: "var(--surface, #12161d)",
          border: "1px solid var(--border, #232a35)",
          borderRadius: "var(--radius2, 12px)",
          padding: 32,
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--danger-dim, rgba(239,68,68,0.12))",
            color: "var(--danger, #ef4444)",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1
          className="font-head-itm"
          style={{ fontSize: 20, fontWeight: 700, color: "var(--text, #e8edf4)", marginBottom: 10, letterSpacing: -0.2 }}
        >
          {title}
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text2, #9aa7b8)", marginBottom: expiresText ? 16 : 24 }}>
          {info?.message ||
            t("Tizimdan foydalanish muddati tugadi. Davom etish uchun ta'minotchi bilan bog'laning.")}
        </p>

        {expiresText && (
          <div
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text3, #6b7787)",
              border: "1px solid var(--border, #232a35)",
              borderRadius: "var(--radius, 8px)",
              padding: "8px 14px",
              marginBottom: 24,
            }}
          >
            {t("Amal qilish muddati")}: {expiresText}
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--text3, #6b7787)", borderTop: "1px solid var(--border, #232a35)", paddingTop: 16 }}>
          {t("Bog'lanish uchun tizim ta'minotchisiga murojaat qiling.")}
        </div>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "var(--text3, #6b7787)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {t("Admin: litsenziyani faollashtirish")}
          </button>
        ) : (
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("Litsenziya tokenini shu yerga joylang")}
              rows={3}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                background: "var(--bg, #0b0e14)",
                color: "var(--text, #e8edf4)",
                border: "1px solid var(--border, #232a35)",
                borderRadius: "var(--radius, 8px)",
                padding: 10,
                resize: "vertical",
                marginBottom: 8,
              }}
            />
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t("Superadmin paroli")}
              onKeyDown={(e) => { if (e.key === "Enter" && token.trim() && secret) activate(); }}
              style={{
                width: "100%",
                fontSize: 13,
                background: "var(--bg, #0b0e14)",
                color: "var(--text, #e8edf4)",
                border: "1px solid var(--border, #232a35)",
                borderRadius: "var(--radius, 8px)",
                padding: "9px 10px",
                marginBottom: 8,
              }}
            />
            {formError && (
              <div style={{ fontSize: 12, color: "var(--danger, #ef4444)", marginBottom: 8 }}>{formError}</div>
            )}
            <button
              onClick={activate}
              disabled={busy || !token.trim() || !secret}
              style={{
                width: "100%",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: busy || !token.trim() || !secret ? "var(--text3, #6b7787)" : "var(--accent, #1a6eeb)",
                border: "none",
                borderRadius: "var(--radius, 8px)",
                padding: "10px",
                cursor: busy || !token.trim() || !secret ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t("Faollashtirilmoqda...") : t("Faollashtirish")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
