"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { PasswordStrengthHint, isPasswordStrong } from "@/app/_components/PasswordStrengthHint";
import { SessionList } from "./_components/SessionList";

const TABS = ["umumiy", "xavfsizlik"] as const;
type Tab = (typeof TABS)[number];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 1.6,
  color: "var(--text3)",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg3)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ ...labelStyle, marginBottom: 0, flex: "0 0 140px" }}>{label}</span>
      <span className={mono ? "font-mono" : undefined} style={{ fontSize: 14, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const showToast = useToastStore((s) => s.show);

  const [tab, setTab] = useState<Tab>("umumiy");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionsReloadKey, setSessionsReloadKey] = useState(0);

  const initials = useMemo(() => {
    if (user?.firstName && user?.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase();
    return (user?.login ?? "??").slice(0, 2).toUpperCase();
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError(t("Joriy parolni kiriting."));
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      setError(t("Yangi parol quyidagi talablarga javob bermaydi."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("Yangi parol va tasdiq mos kelmadi."));
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      await refreshMe();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTab("umumiy");
      // Parol almashgach eski seanslar bekor bo'ldi — ro'yxat eskirgan.
      setSessionsReloadKey((k) => k + 1);
      showToast(t("Parol yangilandi"));
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.errors?.[0] : null;
      setError(message ?? t("Saqlab bo'lmadi. Qaytadan urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-transition" style={{ padding: "28px 32px" }}>
      <div style={{
        maxWidth: 780,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius2)",
        overflow: "hidden",
      }} className="nd-fadein-0">

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "24px 28px 20px" }}>
          <div
            className="font-head-itm"
            style={{
              width: 52, height: 52, borderRadius: "var(--radius)",
              background: "var(--profile-avatar-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 19, fontWeight: 700, letterSpacing: 1.5,
              color: "var(--profile-text)", flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="font-head-itm" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.login ?? "—"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
              {user?.role || "—"} · <span className="font-mono">{user?.login ?? "—"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "0 28px", borderBottom: "2px solid var(--border)" }}>
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "none", background: "none",
                color: tab === item ? "var(--accent)" : "var(--text3)",
                borderBottom: tab === item ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -2, transition: "color 0.15s",
              }}
            >
              {item === "umumiy" ? t("Umumiy") : t("Xavfsizlik")}
            </button>
          ))}
        </div>

        <div style={{ padding: "22px 28px 28px" }}>
          {tab === "umumiy" && (
            <div>
              <InfoRow label={t("Ism")} value={user?.firstName || "—"} />
              <InfoRow label={t("Familiya")} value={user?.lastName || "—"} />
              <InfoRow label={t("Login")} value={user?.login || "—"} mono />
              <InfoRow label={t("Rol")} value={user?.role || "—"} />
              <InfoRow label={t("Ruxsatlar")} value={String(user?.permissions.length ?? 0)} mono />
              <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 14 }}>
                {t("Bu ma'lumotlarni administrator o'zgartiradi.")}
              </p>
            </div>
          )}

          {tab === "xavfsizlik" && (
            <form onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
              <h2 className="font-head-itm" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                {t("Parolni o'zgartirish")}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
                {t("Saqlangandan so'ng boshqa qurilmalardagi seanslar yopiladi.")}
              </p>

              {error && (
                <div style={{
                  background: "var(--danger-dim)", color: "var(--danger)",
                  border: "1px solid var(--danger)", borderRadius: "var(--radius)",
                  padding: "10px 12px", fontSize: 13, marginBottom: 18,
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="profile-current-password">{t("Joriy parol")}</label>
                <input
                  id="profile-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="profile-new-password">{t("Yangi parol")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="profile-new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    title={t("Parolni ko'rsatish")}
                    aria-label={t("Parolni ko'rsatish")}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28, borderRadius: "var(--radius)",
                      background: "none", border: "none", cursor: "pointer", color: "var(--text3)",
                    }}
                  >
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                      {!showNew && <line x1="3" y1="21" x2="21" y2="3" />}
                    </svg>
                  </button>
                </div>
                {newPassword.length > 0 && <PasswordStrengthHint password={newPassword} />}
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle} htmlFor="profile-confirm-password">{t("Yangi parolni takrorlang")}</label>
                <input
                  id="profile-confirm-password"
                  type={showNew ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !newPassword || !currentPassword}
                style={{
                  padding: "9px 20px",
                  background: saving || !newPassword || !currentPassword ? "var(--surface2)" : "var(--accent)",
                  color: saving || !newPassword || !currentPassword ? "var(--text3)" : "#fff",
                  border: "none", borderRadius: "var(--radius)",
                  fontSize: 14, fontWeight: 600,
                  cursor: saving || !newPassword || !currentPassword ? "not-allowed" : "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                {saving ? t("Saqlanmoqda...") : t("Parolni o'zgartirish")}
              </button>
            </form>
          )}

          {tab === "xavfsizlik" && (
            <div style={{ marginTop: 32, paddingTop: 26, borderTop: "1px solid var(--border)" }}>
              <SessionList reloadKey={sessionsReloadKey} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
