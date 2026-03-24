"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const loginAction = useAuthStore((s) => s.login);
  const uiFont = "var(--font-inter), Inter, sans-serif";

  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"login" | "password" | null>(null);

  const hasError = Boolean(error);
  const lookOffsetX =
    focusedField === "login"
      ? ((loginVal.length % 7) - 3) * 0.8
      : focusedField === "password"
        ? 1.2
        : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAction({ login: loginVal, password });
      router.replace("/");
    } catch {
      setError("Login yoki parol noto'g'ri. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: uiFont,
    }}>
      {/* Card */}
      <div style={{
        width: 400,
        background: "var(--bg2)",
        borderRadius: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
        overflow: "hidden",
        fontFamily: uiFont,
      }}>

        {/* Header */}
        <div style={{
          background: "var(--sidebar-bg)",
          padding: "32px 36px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}>
          <div className={`login-bear-wrap${hasError ? " is-error" : ""}`} aria-hidden="true">
            <svg width="96" height="82" viewBox="0 0 96 82" fill="none">
              <circle cx="24" cy="18" r="10" fill="#8d5c3d" />
              <circle cx="72" cy="18" r="10" fill="#8d5c3d" />
              <circle cx="24" cy="18" r="5" fill="#f0d3ba" />
              <circle cx="72" cy="18" r="5" fill="#f0d3ba" />

              <ellipse cx="48" cy="42" rx="31" ry="27" fill="#a86f49" />
              <ellipse cx="48" cy="52" rx="16" ry="12" fill="#f2dcc9" />

              {!hasError ? (
                <>
                  <ellipse cx="38" cy="40" rx="7" ry="6.8" fill="#fff" />
                  <ellipse cx="58" cy="40" rx="7" ry="6.8" fill="#fff" />
                  <circle cx={38 + lookOffsetX} cy="40" r="3.1" fill="#1a2332" />
                  <circle cx={58 + lookOffsetX} cy="40" r="3.1" fill="#1a2332" />
                  <circle cx={39 + lookOffsetX} cy="38.8" r="0.8" fill="#fff" />
                  <circle cx={59 + lookOffsetX} cy="38.8" r="0.8" fill="#fff" />
                </>
              ) : (
                <>
                  <path d="M31 40c2.2 2.4 11.8 2.4 14 0" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M51 40c2.2 2.4 11.8 2.4 14 0" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round" />
                </>
              )}

              <path d="M48 46l-3.4 3.2h6.8L48 46z" fill="#5d3a2a" />
              <path d="M44 55c2.8 2.2 5.2 2.2 8 0" stroke="#5d3a2a" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: 2, color: "#fff", lineHeight: 1,
            }}>OMBORPRO</div>
            <div style={{
              fontSize: 11, color: "var(--sidebar-text2)", letterSpacing: 1.5, marginTop: 4,
            }}>KORXONA TIZIMI</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "32px 36px" }}>
          <div style={{
            fontSize: 19, fontWeight: 700, color: "var(--text)", marginBottom: 22,
          }}>
            Tizimga kirish
          </div>

          {/* Login field */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "var(--text2)", marginBottom: 6, letterSpacing: 0.4,
            }}>
              LOGIN
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text3)", pointerEvents: "none",
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text"
                value={loginVal}
                onChange={(e) => setLoginVal(e.target.value)}
                placeholder="foydalanuvchi nomi"
                required
                autoComplete="username"
                style={{
                  width: "100%",
                  paddingLeft: 38, paddingRight: 14,
                  height: 42,
                  border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  background: "var(--bg3)",
                  color: "var(--text)",
                  fontSize: 15,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { setFocusedField("login"); e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { setFocusedField(null); e.target.style.borderColor = error ? "var(--danger)" : "var(--border)"; }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "var(--text2)", marginBottom: 6, letterSpacing: 0.4,
            }}>
              PAROL
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text3)", pointerEvents: "none",
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  paddingLeft: 38, paddingRight: 14,
                  height: 42,
                  border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  background: "var(--bg3)",
                  color: "var(--text)",
                  fontSize: 15,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { setFocusedField("password"); e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { setFocusedField(null); e.target.style.borderColor = error ? "var(--danger)" : "var(--border)"; }}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginBottom: 18,
              padding: "10px 14px",
              background: "var(--danger-dim)",
              border: "1px solid rgba(217,48,37,0.2)",
              borderRadius: "var(--radius)",
              color: "var(--danger)",
              fontSize: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 44,
              background: loading ? "var(--accent2)" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s",
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--accent2)"; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Kutib turing...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10,17 15,12 10,7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Kirish
              </>
            )}
          </button>
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes bearBob {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-2px); }
            }
            @keyframes bearBlink {
              0%, 88%, 100% { transform: scaleY(1); }
              92%, 96% { transform: scaleY(0.08); }
            }
            @keyframes bearErrorShake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-2px); }
              40% { transform: translateX(2px); }
              60% { transform: translateX(-2px); }
              80% { transform: translateX(2px); }
            }
            .login-bear-wrap {
              width: 102px;
              height: 86px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at 35% 20%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.02) 100%);
              border-radius: 14px;
              box-shadow: 0 0 0 4px rgba(26,110,235,0.2);
              animation: bearBob 2.2s ease-in-out infinite;
            }
            .login-bear-wrap svg {
              transform-origin: center;
              animation: bearBlink 4.6s ease-in-out infinite;
            }
            .login-bear-wrap.is-error {
              box-shadow: 0 0 0 4px rgba(217,48,37,0.2);
              animation: bearErrorShake 0.5s ease-in-out;
            }
            .login-bear-wrap.is-error svg {
              animation: none;
            }
          `}</style>
        </form>
      </div>
    </div>
  );
}
