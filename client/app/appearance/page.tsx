"use client";

import { useEffect, useState } from "react";

const ACCENT_COLORS = [
  { value: "#1a6eeb", label: "Ko'k" },
  { value: "#0d9488", label: "Moviy-yashil" },
  { value: "#16a34a", label: "Yashil" },
  { value: "#22c55e", label: "Och yashil" },
  { value: "#84cc16", label: "Limon" },
  { value: "#eab308", label: "Sariq" },
  { value: "#f97316", label: "To'q sariq" },
  { value: "#ef4444", label: "Qizil" },
  { value: "#ec4899", label: "Pushti" },
  { value: "#a855f7", label: "Binafsha" },
  { value: "#8b5cf6", label: "To'q binafsha" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#6b7280", label: "Kulrang" },
];

const FONT_FAMILIES = [
  { value: "Inter", label: "Inter (Recommended)" },
  { value: "Roboto", label: "Roboto" },
  { value: "system-ui", label: "Tizim shrifti" },
  { value: "Georgia", label: "Georgia (Serif)" },
];

const RADIUS_OPTIONS = [
  { value: "small",  label: "Kichik",  radius: "3px",  radius2: "6px" },
  { value: "medium", label: "Medium",  radius: "6px",  radius2: "10px" },
  { value: "large",  label: "Katta",   radius: "10px", radius2: "16px" },
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex: string, factor: number) {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.round(r * factor).toString(16).padStart(2, "0")}${Math.round(g * factor).toString(16).padStart(2, "0")}${Math.round(b * factor).toString(16).padStart(2, "0")}`;
}

function applyAccent(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const el = document.documentElement;
  const lt = (f: number) => `#${[r,g,b].map(v=>Math.round(v+(255-v)*f).toString(16).padStart(2,"0")).join("")}`;
  el.style.setProperty("--accent", hex);
  el.style.setProperty("--accent-light", lt(0.5));
  el.style.setProperty("--accent2", darken(hex, 0.82));
  el.style.setProperty("--accent3", darken(hex, 0.62));
  el.style.setProperty("--accent-dim", `rgba(${r},${g},${b},0.08)`);
  el.style.setProperty("--accent-mid", `rgba(${r},${g},${b},0.15)`);
  const isDark = localStorage.getItem("theme") === "dark";
  el.style.setProperty("--sidebar-hover", `rgba(${r},${g},${b},${isDark ? 0.12 : 0.06})`);
  el.style.setProperty("--sidebar-active", `rgba(${r},${g},${b},${isDark ? 0.18 : 0.10})`);
  el.style.setProperty("--profile-text", isDark ? lt(0.5) : darken(hex, 0.62));
  el.style.setProperty("--profile-text2", isDark ? hex : darken(hex, 0.82));
  el.style.setProperty("--profile-avatar-bg", `linear-gradient(135deg, rgba(${r},${g},${b},0.12) 0%, rgba(${r},${g},${b},0.22) 50%, rgba(${r},${g},${b},0.14) 100%)`);
}

function applyRadius(value: string) {
  const opt = RADIUS_OPTIONS.find((o) => o.value === value) ?? RADIUS_OPTIONS[1];
  document.documentElement.style.setProperty("--radius", opt.radius);
  document.documentElement.style.setProperty("--radius2", opt.radius2);
}

function applyFont(family: string, scale: number) {
  const root = document.getElementById("app-root");
  if (root) root.style.zoom = String(scale / 100);
  document.body.style.fontFamily = `'${family}', ${family}, sans-serif`;
}

export default function AppearancePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#1a6eeb");
  const [font, setFont] = useState("Inter");
  const [scale, setScale] = useState(100);
  const [radius, setRadius] = useState("medium");

  // Load saved settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const savedAccent = localStorage.getItem("appearance_accent");
    const savedFont = localStorage.getItem("appearance_font");
    const savedScale = localStorage.getItem("appearance_scale");
    const savedRadius = localStorage.getItem("appearance_radius");

    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    if (savedAccent) { setAccent(savedAccent); applyAccent(savedAccent); }
    const resolvedFont = savedFont ?? "Inter";
    const resolvedScale = savedScale ? Number(savedScale) : 100;
    if (savedFont) setFont(resolvedFont);
    if (savedScale) setScale(resolvedScale);
    applyFont(resolvedFont, resolvedScale);
    if (savedRadius) { setRadius(savedRadius); applyRadius(savedRadius); }
  }, []);

  function handleTheme(val: "light" | "dark") {
    setTheme(val);
    localStorage.setItem("theme", val);
    window.dispatchEvent(new CustomEvent("appearance-theme", { detail: { theme: val } }));
  }

  function handleAccent(val: string) {
    setAccent(val);
    localStorage.setItem("appearance_accent", val);
    applyAccent(val);
  }

  function handleFont(val: string) {
    setFont(val);
    localStorage.setItem("appearance_font", val);
    applyFont(val, scale);
  }

  function handleScale(val: number) {
    setScale(val);
    localStorage.setItem("appearance_scale", String(val));
    applyFont(font, val);
  }

  function handleRadius(val: string) {
    setRadius(val);
    localStorage.setItem("appearance_radius", val);
    applyRadius(val);
  }

const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    padding: "32px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
    display: "block",
  };

  const sublabelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--text2)",
    marginBottom: 16,
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--bg3)",
    color: "var(--text)",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238496aa' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  };

  return (
    <div style={{ padding: "28px 32px", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 15, rowGap: 15 }}>

        {/* Mavzu */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Mavzu</h2>
          <p style={sublabelStyle}>O&apos;zingizga yoqqan rang sxemasini tanlang</p>
          <label style={labelStyle}>Rang sxemasi</label>
          <div style={{ position: "relative" }}>
            {/* Sun/Moon icon */}
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", pointerEvents: "none", color: "var(--text2)",
            }}>
              {theme === "dark" ? (
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </span>
            <select
              value={theme}
              onChange={(e) => handleTheme(e.target.value as "light" | "dark")}
              style={{ ...selectStyle, paddingLeft: 34 }}
            >
              <option value="light">Yorug&apos; mavzu</option>
              <option value="dark">Qorong&apos;i mavzu</option>
            </select>
          </div>
        </div>

        {/* Asosiy rang */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Asosiy rang</h2>
          <p style={sublabelStyle}>Interfeys uchun asosiy rangni tanlang</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => handleAccent(c.value)}
                style={{
                  width: 40, height: 40,
                  borderRadius: "var(--radius)",
                  background: c.value,
                  border: accent === c.value ? "3px solid var(--text)" : "3px solid transparent",
                  cursor: "pointer",
                  outline: "none",
                  transition: "transform 0.1s, border-color 0.15s",
                  transform: accent === c.value ? "scale(1.1)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Tipografiya */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Tipografiya</h2>
          <p style={sublabelStyle}>Shrift oilasi va masshtabni sozlang</p>

          <label style={labelStyle}>Shrift oilasi</label>
          <select value={font} onChange={(e) => handleFont(e.target.value)} style={{ ...selectStyle, marginBottom: 20 }}>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Masshtab: {scale}%</label>
          </div>
          <input
            type="range"
            min={80} max={120} step={5}
            value={scale}
            onChange={(e) => handleScale(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text3)", fontSize: 12, marginTop: 4 }}>
            <span>80%</span><span>100%</span><span>120%</span>
          </div>
        </div>

        {/* Chegara radiusi */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Chegara radiusi</h2>
          <p style={sublabelStyle}>Komponentlarning yumaloqligini sozlang</p>
          <label style={labelStyle}>Radius o&apos;lchami</label>
          <select value={radius} onChange={(e) => handleRadius(e.target.value)} style={selectStyle}>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Preview */}
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            {RADIUS_OPTIONS.map((r) => (
              <div key={r.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 48, height: 32,
                  background: radius === r.value ? "var(--accent)" : "var(--surface2)",
                  border: `1px solid ${radius === r.value ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: r.radius2,
                  transition: "background 0.2s",
                }} />
                <span style={{ fontSize: 11, color: radius === r.value ? "var(--accent)" : "var(--text3)" }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
