export type RugbyHemisphere = "northern" | "southern" | "unknown";

export type TeamType =
  | "club"
  | "international"
  | "franchise"
  | "provincial"
  | "academy"
  | "other";

export const TEAM_TYPE_OPTIONS: Array<{ value: TeamType; label: string }> = [
  { value: "club", label: "Club" },
  { value: "international", label: "International" },
  { value: "franchise", label: "Franchise" },
  { value: "provincial", label: "Provincial" },
  { value: "academy", label: "Academy" },
  { value: "other", label: "Other" },
];

export const HEMISPHERE_OPTIONS: Array<{ value: RugbyHemisphere | ""; label: string }> = [
  { value: "", label: "Not set" },
  { value: "northern", label: "Northern Hemisphere" },
  { value: "southern", label: "Southern Hemisphere" },
  { value: "unknown", label: "Unknown" },
];

const CLUB_LIKE_TEAM_TYPES = new Set<TeamType>([
  "club",
  "franchise",
  "provincial",
  "academy",
  "other",
]);

export function hemisphereLabel(hemisphere: RugbyHemisphere): string {
  if (hemisphere === "northern") return "Northern Hemisphere";
  if (hemisphere === "southern") return "Southern Hemisphere";
  return "Unknown";
}

export function resolveHemisphereFromDb(value: string | null | undefined): RugbyHemisphere {
  if (value === "northern" || value === "southern" || value === "unknown") return value;
  return "unknown";
}

export function normalizeTeamType(value: string | null | undefined): TeamType | null {
  if (
    value === "club" ||
    value === "international" ||
    value === "franchise" ||
    value === "provincial" ||
    value === "academy" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

export function teamPassesMatchType(
  teamType: TeamType | null | undefined,
  matchType: "all" | "club" | "international",
): boolean {
  if (matchType === "all") return true;
  if (!teamType) return false;
  if (matchType === "international") return teamType === "international";
  return CLUB_LIKE_TEAM_TYPES.has(teamType);
}

export function isKnownHemisphere(hemisphere: RugbyHemisphere): boolean {
  return hemisphere === "northern" || hemisphere === "southern";
}

export function detectNeutralVenueFromSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const record = snapshot as Record<string, unknown>;
  return record.neutralVenue === true || record.isNeutral === true || record.neutral === true;
}

export const HEMISPHERE_RULE_EXPLANATION =
  "Teams must have an explicit hemisphere value in admin. Missing values are treated as Unknown and excluded unless Include Unknown is enabled. Hemisphere is never inferred silently during table calculation.";
