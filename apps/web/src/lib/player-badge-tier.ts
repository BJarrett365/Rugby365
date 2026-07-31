/**
 * Rugby365 Player Badge rarity system — FIFA-style metal frames.
 * Layout never changes; only frame colours / metal gradients.
 *
 * Planet Rugby site colours must NOT replace these rarity colours.
 */

export type PlayerBadgeRarity =
  | "bronze"
  | "silver"
  | "gold"
  | "elite"
  | "world_class"
  | "legend";

/** @deprecated Use PlayerBadgeRarity */
export type PlayerBadgeTier = PlayerBadgeRarity;

export type PlayerBadgeMetalPalette = {
  /** Primary metal (brand hex from design system) */
  base: string;
  highlight: string;
  mid: string;
  shadow: string;
  deep: string;
  /** Inner panel / glass accents */
  panel: string;
  accent: string;
  glow: string;
  pattern: string;
};

export const PLAYER_BADGE_METALS: Record<PlayerBadgeRarity, PlayerBadgeMetalPalette> = {
  bronze: {
    base: "#8A5A2B",
    highlight: "#D4A574",
    mid: "#A86F38",
    shadow: "#5C3A18",
    deep: "#2E1C0C",
    panel: "#1A120A",
    accent: "#C4894A",
    glow: "rgba(138, 90, 43, 0.45)",
    pattern: "rgba(212, 165, 116, 0.22)",
  },
  silver: {
    base: "#BFC5CC",
    highlight: "#F2F4F6",
    mid: "#9AA3AC",
    shadow: "#6B737C",
    deep: "#2E3338",
    panel: "#121518",
    accent: "#D5DAE0",
    glow: "rgba(191, 197, 204, 0.4)",
    pattern: "rgba(242, 244, 246, 0.18)",
  },
  gold: {
    base: "#D8B04A",
    highlight: "#F5E6A8",
    mid: "#C49A32",
    shadow: "#8A6A1C",
    deep: "#3D2E0A",
    panel: "#161208",
    accent: "#E7BC63",
    glow: "rgba(216, 176, 74, 0.5)",
    pattern: "rgba(245, 230, 168, 0.24)",
  },
  elite: {
    base: "#2E6DB5",
    highlight: "#7EB6F0",
    mid: "#245A96",
    shadow: "#163A66",
    deep: "#0A1C33",
    panel: "#081420",
    accent: "#5B9FE0",
    glow: "rgba(46, 109, 181, 0.48)",
    pattern: "rgba(126, 182, 240, 0.22)",
  },
  world_class: {
    base: "#7A3FE5",
    highlight: "#C4A0FF",
    mid: "#642FCB",
    shadow: "#3E1A8A",
    deep: "#1A0A3D",
    panel: "#100824",
    accent: "#A878F0",
    glow: "rgba(122, 63, 229, 0.5)",
    pattern: "rgba(196, 160, 255, 0.24)",
  },
  legend: {
    base: "#121212",
    highlight: "#F5E6A8",
    mid: "#3A3A3A",
    shadow: "#000000",
    deep: "#000000",
    panel: "#0A0A0A",
    accent: "#D8B04A",
    glow: "rgba(216, 176, 74, 0.42)",
    pattern: "rgba(245, 230, 168, 0.16)",
  },
};

/**
 * Default rarity from career rating — gold / purple / blue like the mock.
 * Gold = absolute top (Dupont-tier). World-class = purple. Elite = blue.
 * Legend is reserved for 99+ or explicit override.
 */
export function playerBadgeRarityFromRating(
  rating: number | null | undefined,
): PlayerBadgeRarity {
  if (rating == null || !Number.isFinite(rating)) return "bronze";
  if (rating >= 99) return "legend";
  if (rating >= 97) return "gold";
  if (rating >= 94) return "world_class";
  if (rating >= 88) return "elite";
  if (rating >= 78) return "silver";
  return "bronze";
}

/** @deprecated Use playerBadgeRarityFromRating */
export function playerBadgeTierFromRating(
  rating: number | null | undefined,
): PlayerBadgeRarity {
  return playerBadgeRarityFromRating(rating);
}

/** Export pixel sizes for FUT-style 360×520 artboard (~2:2.9). */
export const PLAYER_BADGE_SIZES = {
  sm: { width: 110, height: 159 },
  md: { width: 200, height: 289 },
  lg: { width: 300, height: 433 },
  micro: { width: 64, height: 92 },
} as const;

export type PlayerBadgeSize = keyof typeof PLAYER_BADGE_SIZES;
