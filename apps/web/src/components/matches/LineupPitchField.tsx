"use client";

import { useId } from "react";

/** Dark rugby pitch markings behind the XV formation. */

export function LineupPitchField() {
  const shadeId = `pitch-shade-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className="pr-lineup-pitch__field"
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.12)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="160" fill="#163033" />
      <rect x="0" y="0" width="100" height="160" fill={`url(#${shadeId})`} />
      <rect
        x="3.5"
        y="3.5"
        width="93"
        height="153"
        fill="none"
        stroke="rgba(210,220,220,0.5)"
        strokeWidth="0.75"
      />
      {[3.5, 27, 50, 80, 110, 133, 156.5].map((y) => (
        <line
          key={y}
          x1="3.5"
          y1={y}
          x2="96.5"
          y2={y}
          stroke="rgba(210,220,220,0.42)"
          strokeWidth={y === 80 ? 1 : 0.55}
        />
      ))}
      <line
        x1="13"
        y1="3.5"
        x2="13"
        y2="156.5"
        stroke="rgba(210,220,220,0.28)"
        strokeWidth="0.5"
        strokeDasharray="2.2 2"
      />
      <line
        x1="87"
        y1="3.5"
        x2="87"
        y2="156.5"
        stroke="rgba(210,220,220,0.28)"
        strokeWidth="0.5"
        strokeDasharray="2.2 2"
      />
      <line
        x1="27"
        y1="3.5"
        x2="27"
        y2="156.5"
        stroke="rgba(210,220,220,0.18)"
        strokeWidth="0.45"
        strokeDasharray="1.6 2"
      />
      <line
        x1="73"
        y1="3.5"
        x2="73"
        y2="156.5"
        stroke="rgba(210,220,220,0.18)"
        strokeWidth="0.45"
        strokeDasharray="1.6 2"
      />
      {[
        [13, 27],
        [87, 27],
        [13, 50],
        [87, 50],
        [13, 80],
        [87, 80],
        [13, 110],
        [87, 110],
        [13, 133],
        [87, 133],
        [50, 27],
        [50, 50],
        [50, 110],
        [50, 133],
      ].map(([x, y], i) => (
        <g key={i} stroke="rgba(210,220,220,0.45)" strokeWidth="0.5">
          <line x1={x! - 1.8} y1={y} x2={x! + 1.8} y2={y} />
          <line x1={x} y1={y! - 1.8} x2={x} y2={y! + 1.8} />
        </g>
      ))}
    </svg>
  );
}
