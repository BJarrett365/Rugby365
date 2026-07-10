/** Official Nations Championship hemisphere pools (2026 format). */
export const NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS = [
  "England",
  "France",
  "Ireland",
  "Italy",
  "Scotland",
  "Wales",
] as const;

export const NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS = [
  "Argentina",
  "Australia",
  "Fiji",
  "Japan",
  "New Zealand",
  "South Africa",
] as const;

export const NATIONS_CHAMPIONSHIP_COMPETITION_SLUG = "nations-championship";

const NORTHERN_KEYS = new Set(
  NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS.map((name) => teamKey(name)),
);
const SOUTHERN_KEYS = new Set(
  NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS.map((name) => teamKey(name)),
);

function teamKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isNationsChampionshipSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const normalized = slug.trim().toLowerCase();
  return (
    normalized === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG ||
    normalized === "world-rugby-nations-championship"
  );
}

export function nationsChampionshipHemisphereForTeam(
  teamName: string,
): "northern" | "southern" | null {
  const key = teamKey(teamName);
  if (NORTHERN_KEYS.has(key)) return "northern";
  if (SOUTHERN_KEYS.has(key)) return "southern";
  return null;
}

export function nationsChampionshipHemisphereLabel(hemisphere: "northern" | "southern"): string {
  return hemisphere === "northern" ? "Northern Hemisphere" : "Southern Hemisphere";
}
