"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const router      = useRouter();
  const loginAction = useAuthStore((s) => s.login);
  const uiFont      = "var(--font-inter), Inter, sans-serif";

  const [loginVal,      setLoginVal]      = useState("");
  const [password,      setPassword]      = useState("");
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const [exitAnim,      setExitAnim]      = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const mouse = { x: -9999, y: -9999 };
    const MOUSE_REPEL = 100;
    const MOUSE_LINE  = 160;

    const onMouseMove  = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 140;
    const MAX_DIST = 150;
    const COLORS = [
      { r: 99,  g: 153, b: 255 },
      { r: 120, g: 220, b: 190 },
      { r: 180, g: 120, b: 255 },
      { r: 80,  g: 200, b: 255 },
    ];
    const particles = Array.from({ length: COUNT }, () => {
      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r:  Math.random() * 2.2 + 1.2,
        cr: c.r, cg: c.g, cb: c.b,
      };
    });

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        const mdx   = p.x - mouse.x;
        const mdy   = p.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < MOUSE_REPEL && mdist > 0) {
          const force = (MOUSE_REPEL - mdist) / MOUSE_REPEL;
          p.x += (mdx / mdist) * force * 3.5;
          p.y += (mdy / mdist) * force * 3.5;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      for (const p of particles) {
        const mdx   = p.x - mouse.x;
        const mdy   = p.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < MOUSE_LINE) {
          const alpha = (1 - mdist / MOUSE_LINE) * 0.55;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.28;
            const mr = (particles[i].cr + particles[j].cr) / 2;
            const mg = (particles[i].cg + particles[j].cg) / 2;
            const mb = (particles[i].cb + particles[j].cb) / 2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${mr},${mg},${mb},${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},0.55)`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAction({ login: loginVal, password });
      // Tell the browser to save/suggest these credentials next time
      if (typeof window !== "undefined" && "PasswordCredential" in window) {
        const cred = new (window as unknown as { PasswordCredential: new (init: { id: string; password: string }) => Credential }).PasswordCredential({
          id: loginVal,
          password,
        });
        await navigator.credentials.store(cred);
      }
      setExitAnim(true);
      setTimeout(() => router.replace("/"), 600);
    } catch {
      setError("Login yoki parol noto'g'ri. Qayta urinib ko'ring.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1424",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: uiFont,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position: "absolute", top: "15%", left: "20%",
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,153,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "10%", right: "18%",
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,120,255,0.10) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <canvas ref={canvasRef} style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Exit overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "#0d1424",
        opacity: exitAnim ? 1 : 0,
        pointerEvents: exitAnim ? "all" : "none",
        transition: "opacity 0.5s ease",
      }} />

      {/* Card */}
      <div style={{
        width: 420,
        background: "#161f33",
        borderRadius: 20,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        position: "relative", zIndex: 1,
        opacity: exitAnim ? 0 : mounted ? 1 : 0,
        transform: exitAnim
          ? "translateY(-20px) scale(0.95)"
          : mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        transition: exitAnim
          ? "opacity 0.35s ease, transform 0.35s ease"
          : "opacity 0.4s ease, transform 0.4s ease",
      }}>

        {/* Gradient Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2744 0%, #1e3a6e 100%)",
          padding: "36px 40px 30px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Header decoration */}
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 120, height: 120, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -20, left: -20,
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(255,255,255,0.03)", pointerEvents: "none",
          }} />

          {/* Logo icon */}
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            backdropFilter: "blur(8px)",
          }}>
            <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          {/* Brand name */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: 3.5, color: "#fff",
              lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}>
              OMBORPRO
            </div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.55)",
              letterSpacing: 3, marginTop: 6, fontWeight: 500,
            }}>
              KORXONA TIZIMI
            </div>
          </div>

          {/* Divider accent */}
          <div style={{
            width: 40, height: 2, borderRadius: 1,
            background: "rgba(255,255,255,0.25)", marginTop: 2,
          }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "30px 40px 36px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
            Tizimga kirish
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 26 }}>
            Davom etish uchun ma&apos;lumotlaringizni kiriting
          </div>

          {/* Login field */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="username" style={{
              display: "block", fontSize: 11.5, fontWeight: 700,
              color: "#94a3b8", marginBottom: 7, letterSpacing: 0.8,
            }}>
              LOGIN
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                color: "#64748b", pointerEvents: "none", display: "flex",
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="username" type="text" value={loginVal} name="username"
                onChange={(e) => setLoginVal(e.target.value)}
                placeholder="foydalanuvchi nomi" required autoComplete="username"
                style={{
                  width: "100%", paddingLeft: 40, paddingRight: 14, height: 44,
                  border: `1.5px solid ${error ? "#d93025" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, background: "#1e2a42",
                  color: "#e2e8f0", fontSize: 14.5, outline: "none",
                  transition: "border-color 0.18s, box-shadow 0.18s", boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? "#d93025" : "rgba(255,255,255,0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password" style={{
              display: "block", fontSize: 11.5, fontWeight: 700,
              color: "#94a3b8", marginBottom: 7, letterSpacing: 0.8,
            }}>
              PAROL
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                color: "#64748b", pointerEvents: "none", display: "flex",
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password" type={showPassword ? "text" : "password"} value={password} name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                style={{
                  width: "100%", paddingLeft: 40, paddingRight: 48, height: 44,
                  border: `1.5px solid ${error ? "#d93025" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, background: "#1e2a42",
                  color: "#e2e8f0", fontSize: 14.5, outline: "none",
                  transition: "border-color 0.18s, box-shadow 0.18s", boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? "#d93025" : "rgba(255,255,255,0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Yashirish" : "Ko'rsatish"}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#64748b", padding: 4, display: "flex", alignItems: "center",
                  transition: "color 0.15s", borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >
                {showPassword ? (
                  <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 18, padding: "11px 14px",
              background: "var(--danger-dim)", border: "1px solid rgba(217,48,37,0.25)",
              borderRadius: 10, color: "var(--danger)",
              fontSize: 13.5, display: "flex", alignItems: "center", gap: 9,
            }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", height: 46,
              background: loading
                ? "#1558c7"
                : "linear-gradient(135deg, #1a6eeb 0%, #1558c7 100%)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
              letterSpacing: 0.3,
              boxShadow: loading ? "none" : "0 4px 16px rgba(99,153,255,0.3)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.92";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(99,153,255,0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(99,153,255,0.3)";
              }
            }}
            onMouseDown={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
            onMouseUp={(e)   => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Kutib turing...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10,17 15,12 10,7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Kirish
              </>
            )}
          </button>

          {/* Footer */}
          <div style={{
            marginTop: 22, paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            textAlign: "center",
            fontSize: 12, color: "#475569",
          }}>
            © {new Date().getFullYear()} OmborPro — Barcha huquqlar himoyalangan
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        input::placeholder { color: var(--text3); opacity: 0.7; }
      `}</style>
    </div>
  );
}
