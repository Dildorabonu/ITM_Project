"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/app/_components/ConfirmModal";

export interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// User-Agent satri foydalanuvchiga ko'rsatish uchun juda uzun — brauzer va tizim
// nomini ajratib olamiz. Topilmasa satrning boshi qaytariladi.
function describeDevice(ua: string | null): string {
  if (!ua) return "—";

  const browser =
    /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Chrome\//.test(ua) ? "Chrome"
      : /Safari\//.test(ua) ? "Safari"
      : null;

  const os =
    /Windows NT 10|Windows NT 11/.test(ua) ? "Windows"
      : /Windows/.test(ua) ? "Windows"
      : /Android/.test(ua) ? "Android"
      : /iPhone|iPad|iOS/.test(ua) ? "iOS"
      : /Mac OS X/.test(ua) ? "macOS"
      : /Linux/.test(ua) ? "Linux"
      : null;

  if (!browser && !os) return ua.slice(0, 40);
  return [browser, os].filter(Boolean).join(" · ");
}

// Frontend proksisi orqali kelgan so'rovda backend faqat proksining o'zini ko'radi,
// ya'ni IP har doim loopback bo'lib chiqadi va hech nima bildirmaydi. Shunday paytda
// uni ko'rsatmaymiz. Oldiga chinakam reverse proxy qo'yilib, X-Forwarded-For kela
// boshlagach, haqiqiy manzil o'z-o'zidan paydo bo'ladi.
function publicIp(ip: string | null): string | null {
  if (!ip) return null;
  const value = ip.trim();
  if (value === "::1" || value === "127.0.0.1" || value.startsWith("::ffff:127.")) return null;
  return value;
}

function formatMoment(iso: string, t: (s: string) => string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return `${t("bugun")} ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `${t("kecha")} ${time}`;

  return `${date.toLocaleDateString("uz-UZ")} ${time}`;
}

export function SessionList({ reloadKey }: { reloadKey: number }) {
  const t = useT();
  const showToast = useToastStore((s) => s.show);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/auth/sessions");
      setSessions(res.data.result ?? []);
    } catch {
      setError(t("Seanslarni yuklab bo'lmadi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load, reloadKey]);

  async function revoke(id: string) {
    setBusy(true);
    try {
      await api.delete(`/api/auth/sessions/${id}`);
      setPendingId(null);
      showToast(t("Seans tugatildi"));
      await load();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.errors?.[0] : null;
      setError(message ?? t("Seansni tugatib bo'lmadi."));
      setPendingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    setBusy(true);
    try {
      const res = await api.delete("/api/auth/sessions");
      setConfirmAll(false);
      showToast(`${res.data.result ?? 0} ${t("ta seans tugatildi")}`);
      await load();
    } catch {
      setError(t("Seanslarni tugatib bo'lmadi."));
      setConfirmAll(false);
    } finally {
      setBusy(false);
    }
  }

  const others = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <h2 className="font-head-itm" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {t("Faol seanslar")}
        </h2>
        {others > 0 && (
          <button
            type="button"
            onClick={() => setConfirmAll(true)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "var(--danger)",
            }}
          >
            {t("Boshqa hammasini tugatish")}
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
        {t("Hisobingizga kirilgan qurilmalar")}
      </p>

      {error && (
        <div style={{
          background: "var(--danger-dim)", color: "var(--danger)",
          border: "1px solid var(--danger)", borderRadius: "var(--radius)",
          padding: "10px 12px", fontSize: 13, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ height: 46, background: "var(--surface2)", borderRadius: "var(--radius)" }} className="animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text3)" }}>{t("Faol seans topilmadi.")}</p>
      ) : (
        <div>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "12px 0", borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
                  {describeDevice(session.userAgent)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  {publicIp(session.ipAddress) && (
                    <>
                      <span className="font-mono">{publicIp(session.ipAddress)}</span>
                      {" · "}
                    </>
                  )}
                  {t("kirilgan")} {formatMoment(session.startedAt, t)}
                </div>
              </div>

              {session.isCurrent ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 9px", borderRadius: 999,
                  background: "var(--success-dim)", color: "var(--success)",
                  fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)" }} />
                  {t("Shu qurilma")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingId(session.id)}
                  style={{
                    padding: "5px 12px", fontSize: 13, fontWeight: 600,
                    background: "var(--danger-dim)", color: "var(--danger)",
                    border: "none", borderRadius: "var(--radius)", cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("Tugatish")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={pendingId !== null}
        title={t("Seansni tugatish")}
        message={t("Bu qurilma tizimdan chiqariladi va qayta kirish uchun parol so'raladi.")}
        confirmLabel={t("Tugatish")}
        loading={busy}
        variant="danger"
        onConfirm={() => pendingId && revoke(pendingId)}
        onCancel={() => setPendingId(null)}
      />

      <ConfirmModal
        open={confirmAll}
        title={t("Boshqa hammasini tugatish")}
        message={t("Shu qurilmadan tashqari barcha seanslar tugatiladi.")}
        confirmLabel={t("Tugatish")}
        loading={busy}
        variant="danger"
        onConfirm={revokeOthers}
        onCancel={() => setConfirmAll(false)}
      />
    </div>
  );
}
