"use client";

import type { CSSProperties } from "react";

export type HonourMedalKind = "gold" | "silver" | "bronze";

const PALETTE: Record<
  HonourMedalKind,
  { rim: string; face: string; highlight: string; emboss: string }
> = {
  gold: {
    rim: "#C9A227",
    face: "#E8C547",
    highlight: "#FFF1A8",
    emboss: "#8B6914",
  },
  silver: {
    rim: "#8A939E",
    face: "#C5CDD6",
    highlight: "#F2F5F8",
    emboss: "#5C6570",
  },
  bronze: {
    rim: "#A86B3C",
    face: "#C8884E",
    highlight: "#E8B888",
    emboss: "#6E3F1F",
  },
};

type Props = {
  type: HonourMedalKind;
  size?: number;
  className?: string;
  title?: string;
};

/** Rugby365-owned medal mark — no third-party artwork. */
export function HonourMedal({ type, size = 36, className, title }: Props) {
  const p = PALETTE[type];
  const label = title ?? `${type} medal`;
  const style = { width: size, height: size } satisfies CSSProperties;

  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id={`hm-face-${type}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={p.highlight} />
          <stop offset="55%" stopColor={p.face} />
          <stop offset="100%" stopColor={p.rim} />
        </radialGradient>
        <linearGradient id={`hm-rim-${type}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.highlight} />
          <stop offset="50%" stopColor={p.rim} />
          <stop offset="100%" stopColor={p.emboss} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#hm-rim-${type})`} />
      <circle cx="32" cy="32" r="24" fill={`url(#hm-face-${type})`} />
      <circle
        cx="32"
        cy="32"
        r="20"
        fill="none"
        stroke={p.emboss}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <path
        d="M32 18 L35.2 26.2 L44 27.2 L37.4 33 L39.2 41.6 L32 36.8 L24.8 41.6 L26.6 33 L20 27.2 L28.8 26.2 Z"
        fill={p.emboss}
        fillOpacity="0.55"
      />
    </svg>
  );
}

type AwardIconProps = {
  size?: number;
  className?: string;
  variant?: "coach" | "world" | "player" | "generic";
};

/** Personal-award badge (rosette) — distinct from medals/trophies. */
export function HonourAwardIcon({
  size = 28,
  className,
  variant = "generic",
}: AwardIconProps) {
  const accent =
    variant === "world" ? "#5B8DEF" : variant === "coach" ? "#3DDC97" : "#E8C547";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Award"
    >
      <circle cx="24" cy="20" r="14" fill={accent} opacity="0.9" />
      <circle cx="24" cy="20" r="9" fill="#0B1C2C" opacity="0.35" />
      <path
        d="M18 30 L14 44 L24 38 L34 44 L30 30"
        fill={accent}
        opacity="0.85"
      />
      <circle cx="24" cy="20" r="4" fill="#F7F4EA" />
    </svg>
  );
}

type TrophyIconProps = {
  size?: number;
  className?: string;
  variant?: "major" | "domestic";
};

export function HonourTrophyIcon({
  size = 28,
  className,
  variant = "major",
}: TrophyIconProps) {
  const fill = variant === "major" ? "#E8C547" : "#C5CDD6";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Trophy"
    >
      <path
        d="M14 10 H34 V18 C34 24 30 28 24 28 C18 28 14 24 14 18 Z"
        fill={fill}
      />
      <path d="M14 12 H8 C8 18 12 22 16 22" fill="none" stroke={fill} strokeWidth="3" />
      <path d="M34 12 H40 C40 18 36 22 32 22" fill="none" stroke={fill} strokeWidth="3" />
      <rect x="22" y="28" width="4" height="8" fill={fill} />
      <rect x="16" y="36" width="16" height="4" rx="1" fill={fill} />
    </svg>
  );
}

export function HonourIcon({
  iconKey,
  size = 28,
  className,
}: {
  iconKey?: string | null;
  size?: number;
  className?: string;
}) {
  switch (iconKey) {
    case "medal_gold":
      return <HonourMedal type="gold" size={size} className={className} />;
    case "medal_silver":
      return <HonourMedal type="silver" size={size} className={className} />;
    case "medal_bronze":
      return <HonourMedal type="bronze" size={size} className={className} />;
    case "trophy_major":
      return <HonourTrophyIcon size={size} className={className} variant="major" />;
    case "trophy_domestic":
      return <HonourTrophyIcon size={size} className={className} variant="domestic" />;
    case "award_world":
      return <HonourAwardIcon size={size} className={className} variant="world" />;
    case "award_coach":
      return <HonourAwardIcon size={size} className={className} variant="coach" />;
    case "award_player":
      return <HonourAwardIcon size={size} className={className} variant="player" />;
    case "runner_up":
      return <HonourMedal type="silver" size={size} className={className} />;
    case "third_place":
      return <HonourMedal type="bronze" size={size} className={className} />;
    default:
      return <HonourAwardIcon size={size} className={className} variant="generic" />;
  }
}
