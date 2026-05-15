"use client";

import React, { useEffect, useState } from "react";

interface EkLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
  ariaLabel?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function EkLogo({
  size = 128,
  animated = true,
  className,
  ariaLabel = "ek logo",
}: EkLogoProps) {
  const reducedMotion = useReducedMotion();
  const play = animated && !reducedMotion;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <linearGradient id="ekBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2670e8" />
          <stop offset="100%" stopColor="#1a5dd1" />
        </linearGradient>
        <path
          id="ekDotPath"
          d="M 450 95 C 470 55, 410 40, 340 50 C 270 65, 220 110, 215 200"
        />
      </defs>

      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="96"
        ry="96"
        fill="url(#ekBgGrad)"
      />

      <g transform="translate(385 400) scale(1 1.15) translate(-385 -400)">
        <text
          x="385"
          y="320"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Sora, sans-serif"
          fontWeight="700"
          fontSize="360"
          fill="#f1f4f8"
        >
          k
        </text>
      </g>

      <g>
        {play && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 215 320; 0 215 320; 90 215 320; 90 215 320; 0 215 320; 0 215 320; 0 215 320"
            keyTimes="0; 0.18; 0.202; 0.281; 0.31; 0.36; 1"
            dur="5s"
            repeatCount="indefinite"
          />
        )}
        <text
          x="215"
          y="320"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Sora, sans-serif"
          fontWeight="700"
          fontSize="360"
          fill="#f1f4f8"
        >
          e
        </text>
      </g>

      {play ? (
        <g>
          <circle r="22" fill="#5eead4" opacity="0.35" filter="blur(4px)">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              keyTimes="0; 0.18; 0.36; 1"
              keyPoints="0; 1; 0; 0"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
            >
              <mpath href="#ekDotPath" />
            </animateMotion>
          </circle>

          <circle r="22" fill="#5eead4">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              keyTimes="0; 0.18; 0.36; 1"
              keyPoints="0; 1; 0; 0"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
            >
              <mpath href="#ekDotPath" />
            </animateMotion>
            <animate
              attributeName="r"
              values="22; 22; 28; 20; 22; 22; 22"
              keyTimes="0; 0.173; 0.18; 0.191; 0.209; 0.36; 1"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ) : (
        <circle cx="450" cy="95" r="22" fill="#5eead4" />
      )}
    </svg>
  );
}
