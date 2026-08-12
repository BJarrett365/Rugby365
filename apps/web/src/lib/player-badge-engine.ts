/**
 * Rule-driven public profile badges. Never manually assign for aesthetics.
 */

export type PlayerBadgeKey =
  | "international_star"
  | "elite_kicker"
  | "game_manager"
  | "in_form"
  | "future_star"
  | "high_value_asset";

export type PlayerProfileBadge = {
  key: PlayerBadgeKey;
  label: string;
  tone: "green" | "blue" | "purple" | "gold" | "amber";
};

export type PlayerBadgeInput = {
  overallRating: number | null;
  kicking: number | null;
  gameManagement: number | null;
  formScore: number | null; // 0–100 preferred; 0–10 accepted
  age: number | null;
  verifiedInternationalCaps: number | null;
  marketValueGbp: number | null;
  valueOutlier: boolean;
};

function form100(form: number | null): number | null {
  if (form == null || !Number.isFinite(form)) return null;
  return form <= 10 ? form * 10 : form;
}

export function computePlayerProfileBadges(input: PlayerBadgeInput): PlayerProfileBadge[] {
  const badges: PlayerProfileBadge[] = [];
  const form = form100(input.formScore);

  if (
    (input.verifiedInternationalCaps ?? 0) >= 30 &&
    (input.overallRating ?? 0) >= 55
  ) {
    badges.push({ key: "international_star", label: "International Star", tone: "gold" });
  }

  if ((input.kicking ?? 0) >= 70) {
    badges.push({ key: "elite_kicker", label: "Elite Kicker", tone: "amber" });
  }

  if ((input.gameManagement ?? 0) >= 65) {
    badges.push({ key: "game_manager", label: "Game Manager", tone: "blue" });
  }

  if ((form ?? 0) >= 65) {
    badges.push({ key: "in_form", label: "In Form", tone: "green" });
  }

  if ((input.age ?? 99) <= 23 && (input.overallRating ?? 0) >= 60) {
    badges.push({ key: "future_star", label: "Future Star", tone: "purple" });
  }

  if (
    !input.valueOutlier &&
    (input.marketValueGbp ?? 0) >= 500_000 &&
    (input.overallRating ?? 0) >= 70
  ) {
    badges.push({ key: "high_value_asset", label: "High Value Asset", tone: "blue" });
  }

  return badges.slice(0, 3);
}
