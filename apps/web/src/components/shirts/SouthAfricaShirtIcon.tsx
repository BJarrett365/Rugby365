import type { CSSProperties } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/**
 * Simple South Africa (Springboks) shirt mark for compact UI overlays.
 * No ids/defs (avoids collisions when multiple icons render).
 */
export function SouthAfricaShirtIcon({ className, style, title }: Props) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 48 60"
      role="img"
      aria-label={title ?? "South Africa shirt"}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Main body */}
      <path
        d="M16.6 16.8 C18.4 13.6 20.8 11.8 24 11.8 C27.2 11.8 29.6 13.6 31.4 16.8 L34.8 15.2 C36.2 17.8 37.2 21.2 37.6 25.2 L38.4 52.2 C38.4 54.6 36.4 56.2 34 56.2 L14 56.2 C11.6 56.2 9.6 54.6 9.6 52.2 L10.4 25.2 C10.8 21.2 11.8 17.8 13.2 15.2 Z"
        fill="#006B3C"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.6"
      />

      {/* Sleeves (solid tone) */}
      <path
        d="M16.6 16.8 C13.8 18.6 10.2 21.4 7.4 25.6 C6.6 26.8 6.4 28.2 6.8 29.4 L10.6 33.2 C12.8 30.2 15.2 27.4 17.8 25.2 L18.6 20.8 Z"
        fill="#006B3C"
      />
      <path
        d="M31.4 16.8 C34.2 18.6 37.8 21.4 40.6 25.6 C41.4 26.8 41.6 28.2 41.2 29.4 L37.4 33.2 C35.2 30.2 32.8 27.4 30.2 25.2 L29.4 20.8 Z"
        fill="#006B3C"
      />

      {/* Collar */}
      <path
        d="M19.6 12.2 C21 10.4 22.4 9.6 24 9.6 C25.6 9.6 27 10.4 28.4 12.2 L27.6 14.8 C26.6 13.4 25.4 12.8 24 12.8 C22.6 12.8 21.4 13.4 20.4 14.8 Z"
        fill="#FFB81C"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.35"
      />

      {/* Chest band */}
      <rect x="12" y="28" width="24" height="6.5" rx="1.1" fill="#FFB81C" opacity="0.95" />

      {/* Side panels (subtle depth) */}
      <path
        d="M10.2 24 L13.8 24 L13.2 53 L10 53 Z"
        fill="#005a31"
        opacity="0.5"
      />
      <path
        d="M37.8 24 L34.2 24 L34.8 53 L38 53 Z"
        fill="#005a31"
        opacity="0.5"
      />
    </svg>
  );
}

