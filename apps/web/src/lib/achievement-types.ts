/** Shared Rugby365 achievements / honours vocabulary (client-safe). */

export const ACHIEVEMENT_ENTITY_TYPES = [
  "coach",
  "player",
  "referee",
  "team",
] as const;
export type AchievementEntityType = (typeof ACHIEVEMENT_ENTITY_TYPES)[number];

export const ACHIEVEMENT_TYPES = [
  "PERSONAL_AWARD",
  "TEAM_HONOUR",
  "MEDAL",
  "PLACEMENT",
  "APPOINTMENT_HONOUR",
] as const;
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

export const ACHIEVEMENT_ROLE_TYPES = [
  "PLAYER",
  "CAPTAIN",
  "COACH",
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "DIRECTOR_OF_RUGBY",
  "TECHNICAL_ROLE",
  "REFEREE",
  "OTHER",
] as const;
export type AchievementRoleType = (typeof ACHIEVEMENT_ROLE_TYPES)[number];

export const ACHIEVEMENT_PLACINGS = [
  "WINNER",
  "RUNNER_UP",
  "THIRD_PLACE",
  "SEMI_FINALIST",
  "FINALIST",
  "OTHER",
] as const;
export type AchievementPlacing = (typeof ACHIEVEMENT_PLACINGS)[number];

export const ACHIEVEMENT_MEDAL_TYPES = ["GOLD", "SILVER", "BRONZE", "NONE"] as const;
export type AchievementMedalType = (typeof ACHIEVEMENT_MEDAL_TYPES)[number];

export const HONOUR_LEVELS = ["MAJOR", "CHAMPIONSHIP", "CUP", "AWARD", "PLACEMENT"] as const;
export type HonourLevel = (typeof HONOUR_LEVELS)[number];

export const ACHIEVEMENT_VERIFICATION_STATUSES = [
  "verified",
  "review",
  "unverified",
] as const;
export type AchievementVerificationStatus =
  (typeof ACHIEVEMENT_VERIFICATION_STATUSES)[number];

export const ACHIEVEMENT_SOURCE_TYPES = [
  "WIKIPEDIA",
  "WIKIDATA",
  "RUGBYPASS",
  "WORLD_RUGBY",
  "COMPETITION_OFFICIAL",
  "TEAM_OFFICIAL",
  "RUGBY365",
  "MANUAL",
] as const;
export type AchievementSourceType = (typeof ACHIEVEMENT_SOURCE_TYPES)[number];

export const HONOUR_ICON_KEYS = [
  "award_world",
  "award_coach",
  "award_player",
  "trophy_major",
  "trophy_domestic",
  "medal_gold",
  "medal_silver",
  "medal_bronze",
  "runner_up",
  "third_place",
] as const;
export type HonourIconKey = (typeof HONOUR_ICON_KEYS)[number];

export type PublicAwardRow = {
  id: string;
  year: number | null;
  title: string;
  organisation: string | null;
  resultLabel: string;
  iconKey: HonourIconKey | string;
};

export type PublicMedalRow = {
  id: string;
  year: number | null;
  competitionName: string;
  resultLabel: string;
  medalType: "gold" | "silver" | "bronze" | "none";
  roleType: string;
  roleGroup: "player" | "coaching" | "other";
};

/** Collapse duplicated organisation prefixes in award titles. */
export function normalizeAwardDisplayTitle(
  awardName: string,
  awardingBody?: string | null,
): { organisation: string | null; title: string } {
  let name = awardName.trim().replace(/\s+/g, " ");
  const body = awardingBody?.trim().replace(/\s+/g, " ") || null;

  // "World Rugby World Rugby Coach of the Year" → strip repeated org
  if (body) {
    const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(?:${escaped}\\s*)+`, "i");
    name = name.replace(re, "").trim() || name;
  }
  name = name.replace(/^(World Rugby)\s+\1\s+/i, "$1 ").trim();

  // If name still starts with body, peel once for display split
  if (body && name.toLowerCase().startsWith(body.toLowerCase())) {
    const rest = name.slice(body.length).trim();
    if (rest) return { organisation: body, title: rest };
  }

  if (body) return { organisation: body, title: name };
  const m = name.match(/^(World Rugby|Pro12|URC|Premiership Rugby)\s+(.+)$/i);
  if (m) return { organisation: m[1], title: m[2] };
  return { organisation: null, title: name };
}

export function medalTypeFromPlacing(
  placing: string | null | undefined,
): "gold" | "silver" | "bronze" | "none" {
  const p = (placing ?? "").toUpperCase();
  if (p === "WINNER" || p === "CHAMPION") return "gold";
  if (p === "RUNNER_UP" || p === "FINALIST") return "silver";
  if (p === "THIRD_PLACE") return "bronze";
  return "none";
}

export function placingFromLegacyAchievementType(type: string): AchievementPlacing {
  switch (type) {
    case "winner":
    case "champion":
      return "WINNER";
    case "runner_up":
      return "RUNNER_UP";
    case "third":
      return "THIRD_PLACE";
    case "semi_final":
      return "SEMI_FINALIST";
    case "finalist":
      return "FINALIST";
    default:
      return "OTHER";
  }
}

export function honourLevelFromLegacy(level: string): HonourLevel {
  switch (level) {
    case "major":
      return "MAJOR";
    case "domestic_major":
      return "CHAMPIONSHIP";
    case "series":
    case "minor":
      return "CUP";
    case "secondary":
      return "CHAMPIONSHIP";
    default:
      return "CUP";
  }
}

export function roleGroupFromRoleType(
  roleType: string | null | undefined,
): "player" | "coaching" | "other" {
  const r = (roleType ?? "").toUpperCase();
  if (r === "PLAYER" || r === "CAPTAIN") return "player";
  if (
    r === "COACH" ||
    r === "HEAD_COACH" ||
    r === "ASSISTANT_COACH" ||
    r === "DIRECTOR_OF_RUGBY" ||
    r === "TECHNICAL_ROLE"
  ) {
    return "coaching";
  }
  // legacy coach_medals.role_type
  if (r === "PLAYER") return "player";
  if (r === "COACH") return "coaching";
  return "other";
}

export function buildAchievementDedupeKey(input: {
  achievementType: string;
  competitionId?: string | null;
  competitionName?: string | null;
  year?: number | null;
  teamId?: string | null;
  teamName?: string | null;
  roleType?: string | null;
  placing?: string | null;
  awardDefinitionId?: string | null;
}): string {
  const parts = [
    input.achievementType,
    input.competitionId ?? (input.competitionName ?? "").toLowerCase().trim(),
    String(input.year ?? 0),
    input.teamId ?? (input.teamName ?? "").toLowerCase().trim(),
    (input.roleType ?? "").toUpperCase(),
    (input.placing ?? "").toUpperCase(),
    input.awardDefinitionId ?? "",
  ];
  return parts.join("|");
}

/** Major honour won = MAJOR/CHAMPIONSHIP + WINNER only. */
export function isMajorHonourWin(input: {
  honourLevel: string;
  placing: string | null | undefined;
  achievementType?: string | null;
}): boolean {
  const level = input.honourLevel.toUpperCase();
  const placing = (input.placing ?? "").toUpperCase();
  if (placing !== "WINNER" && placing !== "CHAMPION") return false;
  if (input.achievementType === "PERSONAL_AWARD") return false;
  return level === "MAJOR" || level === "CHAMPIONSHIP";
}
