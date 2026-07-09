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
  daysLeft: number;
};

const ShieldIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export default function LicensePage() {
  const t = useT();
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("—");

  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Jonli sanoq — qolgan muddatni daqiqagacha yangilab turadi.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function load() {
    try {
      const [s, f] = await Promise.all([
        api.get("/api/license/status"),
        api.get("/api/license/fingerprint"),
      ]);
      setInfo(s.data?.result ?? null);
      setFingerprint(f.data?.result?.fingerprint ?? "—");
    } catch {
      /* status ochiq — xato bo'lsa jim qolamiz */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function activate() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await api.post("/api/license/activate", { token: token.trim(), secret });
      const data = res.data?.result as LicenseInfo | undefined;
      if (data?.valid) {
        setInfo(data);
        setToken("");
        setSecret("");
        setOk(true);
      } else {
        setError(data?.message || t("Litsenziya faollashmadi."));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { errors?: string[] } } };
      setError(err.response?.data?.errors?.[0] || t("Faollashtirishda xatolik."));
    } finally {
      setBusy(false);
    }
  }

  const expiresText = info?.expiresUtc
    ? new Date(info.expiresUtc).toLocaleString("uz-UZ", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const valid = info?.valid;

  return (
    <div className="page-transition" style={{ maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 2 }}>
        <div className="icon-bg ib-blue" style={{ width: 40, height: 40, color: "var(--accent)" }}>
          <ShieldIcon size={20} />
        </div>
        <div>
          <div className="ph-title" style={{ fontSize: 20 }}>{t("Litsenziya")}</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>
            {t("Tizim litsenziyasi holati va yangilash")}
          </div>
        </div>
      </div>

      {/* Holat kartasi */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="itm-card-title">{t("Holat")}</div>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              background: valid ? "var(--success-dim)" : "var(--danger-dim)",
              color: valid ? "var(--success)" : "var(--danger)",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: valid ? "var(--success)" : "var(--danger)" }} />
            {valid ? t("Faol") : (info?.reason || t("Faol emas"))}
          </span>
        </div>

        <div className="itm-card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px 24px" }}>
            <Field label={t("Mijoz")} value={info?.customer || "—"} />
            <Field label={t("Amal qilish muddati")} value={expiresText} />
            <Field label={t("Qolgan muddat")} value={valid && info?.expiresUtc && now ? formatRemaining(info.expiresUtc, now, t) : "—"} accent={valid} />
            <Field label={t("Server barmoq izi")} value={fingerprint} mono />
          </div>

          {info?.message && (
            <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 16, paddingTop: 14, borderTop: "1.5px solid var(--border)" }}>
              {info.message}
            </p>
          )}
        </div>
      </div>

      {/* Yangilash formasi */}
      <div className="itm-card">
        <div className="itm-card-header">
          <div className="itm-card-title">{t("Litsenziyani yangilash")}</div>
        </div>

        <div className="itm-card-body">
          <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16, lineHeight: 1.5 }}>
            {t("Yangi tokenni joylang va superadmin parolini kiriting. Muddat darhol yangilanadi.")}
          </p>

          <label className="form-label" style={{ display: "block", marginBottom: 6 }}>{t("Litsenziya tokeni")}</label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ..."
            rows={3}
            className="form-textarea"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, marginBottom: 14 }}
          />

          <label className="form-label" style={{ display: "block", marginBottom: 6 }}>{t("Superadmin paroli")}</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && token.trim() && secret) activate(); }}
            className="form-input"
            style={{ marginBottom: 14 }}
          />

          {error && <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{error}</div>}
          {ok && <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 12 }}>{t("Litsenziya muvaffaqiyatli yangilandi.")}</div>}

          <button
            className="btn btn-primary"
            onClick={activate}
            disabled={busy || !token.trim() || !secret}
            style={{ opacity: busy || !token.trim() || !secret ? 0.55 : 1, cursor: busy || !token.trim() || !secret ? "not-allowed" : "pointer" }}
          >
            {busy ? t("Faollashtirilmoqda...") : t("Faollashtirish")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Qolgan muddatni kun / soat / daqiqa ko'rinishida formatlaydi. */
function formatRemaining(expiresUtc: string, now: number, t: (s: string) => string): string {
  const ms = new Date(expiresUtc).getTime() - now;
  if (ms <= 0) return t("Tugagan");

  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${t("kun")}`);
  if (hours > 0) parts.push(`${hours} ${t("soat")}`);
  // Kun bo'lmasa — har doim daqiqani ham ko'rsatamiz (masalan "5 daqiqa").
  if (days === 0) parts.push(`${mins} ${t("daqiqa")}`);

  return parts.join(" ");
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="form-label" style={{ marginBottom: 5 }}>{label}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: accent ? "var(--accent)" : "var(--text)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
