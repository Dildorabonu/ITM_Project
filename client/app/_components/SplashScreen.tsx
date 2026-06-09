"use client";

import React from "react";
import EkLogo from "./EkLogo";

interface SplashScreenProps {
  fading: boolean;
}

export default function SplashScreen({ fading }: SplashScreenProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: 26,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        transition: "opacity 0.5s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 42%, var(--accent-mid), transparent 60%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      <div className="splash-logo" style={{ zIndex: 1 }}>
        <EkLogo size={112} />
      </div>

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          className="font-head-itm splash-title"
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: 1.5,
            lineHeight: 1,
          }}
        >
          E-Korxona
        </div>
        <div
          className="font-body-itm splash-sub"
          style={{
            fontSize: 10,
            color: "var(--text3)",
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 600,
            marginTop: 10,
          }}
        >
          Raqamli Korxona Platformasi
        </div>
      </div>

      <div
        className="splash-dots"
        style={{
          display: "flex",
          gap: 6,
          marginTop: 4,
          zIndex: 1,
        }}
      >
        <span className="splash-dot" style={{ animationDelay: "0ms" }} />
        <span className="splash-dot" style={{ animationDelay: "180ms" }} />
        <span className="splash-dot" style={{ animationDelay: "360ms" }} />
      </div>

      <style>{`
        @keyframes splashLogoPulse {
          0%, 100% { transform: scale(1);     }
          50%      { transform: scale(1.035); }
        }
        @keyframes splashLogoGlow {
          0%, 100% { opacity: 0; }
          50%      { opacity: 1; }
        }
        @keyframes splashDot {
          0%, 70%, 100% { transform: scale(0.6); opacity: 0.3; }
          35%           { transform: scale(1);   opacity: 1; }
        }
        @keyframes splashEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .splash-logo  { position: relative; animation: splashLogoPulse 2.4s ease-in-out infinite, splashEnter 0.55s ease both; }
        .splash-logo::before {
          content: ""; position: absolute; inset: -30%; border-radius: 50%; z-index: -1;
          background: radial-gradient(circle, var(--accent-mid), transparent 70%);
          filter: blur(14px); opacity: 0;
          animation: splashLogoGlow 2.4s ease-in-out infinite;
        }
        .splash-title { animation: splashEnter 0.55s ease 0.12s both; }
        .splash-sub   { animation: splashEnter 0.55s ease 0.22s both; }
        .splash-dots  { animation: splashEnter 0.55s ease 0.32s both; }
        .splash-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--accent);
          display: inline-block;
          animation: splashDot 1.2s ease-in-out infinite both;
        }
      `}</style>
    </div>
  );
}
