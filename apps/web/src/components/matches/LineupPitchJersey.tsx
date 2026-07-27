"use client";

import { useId } from "react";

/** Broadcast-style jersey for home / away lineup pitch. */

type Props = {
  number: number | string;
  accent: string;
  variant: "home" | "away";
};

export function LineupPitchJersey({ number, accent, variant }: Props) {
  const uid = useId().replace(/:/g, "");
  const bodyId = `jp-body-${uid}`;
  const shineId = `jp-shine-${uid}`;
  const isHome = variant === "home";
  const base = isHome ? "#121212" : "#0b2228";
  const mid = isHome ? "#1a1a1a" : "#123038";

  return (
    <svg
      className="pr-lineup-pitch__jersey-svg"
      viewBox="0 0 48 52"
      width="48"
      height="52"
      aria-hidden
    >
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mid} />
          <stop offset="100%" stopColor={base} />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
        </linearGradient>
      </defs>

      {/* Left sleeve */}
      <path
        d="M11 12 L3 16.5 L5.5 26 L13 20.5 Z"
        fill={`url(#${bodyId})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Right sleeve */}
      <path
        d="M37 12 L45 16.5 L42.5 26 L35 20.5 Z"
        fill={`url(#${bodyId})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Body */}
      <path
        d="M13 11.5 L17 9.5 L19.5 13.5 L24 15.5 L28.5 13.5 L31 9.5 L35 11.5
           L36.5 42 Q24 47 11.5 42 Z"
        fill={`url(#${bodyId})`}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M13 11.5 L17 9.5 L19.5 13.5 L24 15.5 L28.5 13.5 L31 9.5 L35 11.5
           L36.5 42 Q24 47 11.5 42 Z"
        fill={`url(#${shineId})`}
      />
      {/* Collar */}
      <path
        d="M18 10 Q24 15 30 10 L28 13.5 Q24 16.5 20 13.5 Z"
        fill="#070707"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.7"
      />

      {isHome ? (
        <g stroke={accent} strokeLinecap="round" fill="none">
          <path d="M15.5 17 L22 43" strokeWidth="4.2" opacity="0.95" />
          <path d="M19.5 16 L26 43" strokeWidth="2.8" opacity="0.7" />
        </g>
      ) : (
        <g>
          <rect x="13.5" y="19" width="21" height="3.8" rx="0.4" fill={accent} opacity="0.95" />
          <rect x="13.5" y="26" width="21" height="3.8" rx="0.4" fill={accent} opacity="0.5" />
          <rect x="13.5" y="33" width="21" height="3.8" rx="0.4" fill={accent} opacity="0.95" />
        </g>
      )}

      <text
        x="24"
        y="32"
        textAnchor="middle"
        fill="#fff"
        fontSize="15"
        fontWeight="800"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        style={{ paintOrder: "stroke fill", stroke: "rgba(0,0,0,0.65)", strokeWidth: 2.4 }}
      >
        {number}
      </text>
    </svg>
  );
}
