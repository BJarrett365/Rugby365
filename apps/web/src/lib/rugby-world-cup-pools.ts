/**
 * Official Rugby World Cup pool memberships (men’s finals).
 * Used to render Pool A–F tables when fixture rounds / standing views omit pool labels.
 */

export const RUGBY_WORLD_CUP_SLUGS = new Set(["rugby-world-cup", "rugby-world-cup-men"]);

export type RugbyWorldCupPoolId = "A" | "B" | "C" | "D" | "E" | "F";

export type RugbyWorldCupPoolDefinition = {
  id: RugbyWorldCupPoolId;
  label: string;
  teams: string[];
};

/** Teams per pool: modern (2003–2023) = 5 → 4 pool games; 2027 = 4 → 3 pool games. */
export function poolStageFormSlots(poolTeamCount: number): number {
  return Math.max(1, poolTeamCount - 1);
}

function teamKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\busa\b/g, "united states")
    .replace(/\bunited states of america\b/g, "united states")
    .replace(/\s+/g, " ");
}

const POOLS_BY_YEAR: Record<number, RugbyWorldCupPoolDefinition[]> = {
  // Generated/merged from docs/scraped/rugby-world-cup (Ultimate Rugby + rugbyworldcup.com).
  1987: [
    { id: "A", label: "Pool A", teams: ["Australia", "England", "United States", "Japan"] },
    { id: "B", label: "Pool B", teams: ["Wales", "Ireland", "Canada", "Tonga"] },
    { id: "C", label: "Pool C", teams: ["New Zealand", "Fiji", "Italy", "Argentina"] },
    { id: "D", label: "Pool D", teams: ["France", "Scotland", "Romania", "Zimbabwe"] },
  ],
  1991: [
    { id: "A", label: "Pool A", teams: ["New Zealand", "England", "Italy", "United States"] },
    { id: "B", label: "Pool B", teams: ["Scotland", "Ireland", "Japan", "Zimbabwe"] },
    { id: "C", label: "Pool C", teams: ["Australia", "Samoa", "Wales", "Argentina"] },
    { id: "D", label: "Pool D", teams: ["France", "Canada", "Romania", "Fiji"] },
  ],
  1995: [
    { id: "A", label: "Pool A", teams: ["South Africa", "Australia", "Canada", "Romania"] },
    { id: "B", label: "Pool B", teams: ["England", "Samoa", "Italy", "Argentina"] },
    { id: "C", label: "Pool C", teams: ["New Zealand", "Ireland", "Wales", "Japan"] },
    { id: "D", label: "Pool D", teams: ["France", "Scotland", "Tonga", "Ivory Coast"] },
  ],
  1999: [
    { id: "A", label: "Pool A", teams: ["South Africa", "Scotland", "Uruguay", "Spain"] },
    { id: "B", label: "Pool B", teams: ["New Zealand", "England", "Tonga", "Italy"] },
    { id: "C", label: "Pool C", teams: ["France", "Fiji", "Canada", "Namibia"] },
    { id: "D", label: "Pool D", teams: ["Wales", "Argentina", "Samoa", "Japan"] },
    { id: "E", label: "Pool E", teams: ["Australia", "Ireland", "Romania", "United States"] },
  ],
  2003: [
    { id: "A", label: "Pool A", teams: ["Australia", "Ireland", "Argentina", "Romania", "Namibia"] },
    { id: "B", label: "Pool B", teams: ["France", "Scotland", "Fiji", "United States", "Japan"] },
    { id: "C", label: "Pool C", teams: ["England", "South Africa", "Samoa", "Uruguay", "Georgia"] },
    { id: "D", label: "Pool D", teams: ["New Zealand", "Wales", "Italy", "Canada", "Tonga"] },
  ],
  2007: [
    { id: "A", label: "Pool A", teams: ["South Africa", "England", "Tonga", "Samoa", "United States"] },
    { id: "B", label: "Pool B", teams: ["Australia", "Fiji", "Wales", "Japan", "Canada"] },
    { id: "C", label: "Pool C", teams: ["New Zealand", "Scotland", "Italy", "Romania", "Portugal"] },
    { id: "D", label: "Pool D", teams: ["Argentina", "France", "Ireland", "Georgia", "Namibia"] },
  ],
  2011: [
    { id: "A", label: "Pool A", teams: ["New Zealand", "France", "Tonga", "Canada", "Japan"] },
    { id: "B", label: "Pool B", teams: ["England", "Argentina", "Scotland", "Georgia", "Romania"] },
    { id: "C", label: "Pool C", teams: ["Ireland", "Australia", "Italy", "United States", "Russia"] },
    { id: "D", label: "Pool D", teams: ["South Africa", "Wales", "Samoa", "Fiji", "Namibia"] },
  ],
  2015: [
    { id: "A", label: "Pool A", teams: ["Australia", "Wales", "England", "Fiji", "Uruguay"] },
    { id: "B", label: "Pool B", teams: ["South Africa", "Scotland", "Japan", "Samoa", "United States"] },
    { id: "C", label: "Pool C", teams: ["New Zealand", "Argentina", "Georgia", "Tonga", "Namibia"] },
    { id: "D", label: "Pool D", teams: ["Ireland", "France", "Italy", "Romania", "Canada"] },
  ],
  2019: [
    { id: "A", label: "Pool A", teams: ["Japan", "Ireland", "Scotland", "Samoa", "Russia"] },
    { id: "B", label: "Pool B", teams: ["New Zealand", "South Africa", "Italy", "Namibia", "Canada"] },
    { id: "C", label: "Pool C", teams: ["England", "France", "Argentina", "Tonga", "United States"] },
    { id: "D", label: "Pool D", teams: ["Wales", "Australia", "Fiji", "Georgia", "Uruguay"] },
  ],
  // 2023 France — 4×5 (4 pool games each).
  2023: [
    { id: "A", label: "Pool A", teams: ["France", "New Zealand", "Italy", "Uruguay", "Namibia"] },
    { id: "B", label: "Pool B", teams: ["Ireland", "South Africa", "Scotland", "Tonga", "Romania"] },
    { id: "C", label: "Pool C", teams: ["Wales", "Australia", "Fiji", "Georgia", "Portugal"] },
    { id: "D", label: "Pool D", teams: ["England", "Japan", "Argentina", "Samoa", "Chile"] },
  ],
  // 2027 Australia — 6×4 (3 pool games each). Source: World Rugby draw / Wikipedia.
  2027: [
    { id: "A", label: "Pool A", teams: ["New Zealand", "Australia", "Chile", "Hong Kong"] },
    { id: "B", label: "Pool B", teams: ["South Africa", "Italy", "Georgia", "Romania"] },
    { id: "C", label: "Pool C", teams: ["Argentina", "Fiji", "Spain", "Canada"] },
    { id: "D", label: "Pool D", teams: ["Ireland", "Scotland", "Uruguay", "Portugal"] },
    { id: "E", label: "Pool E", teams: ["France", "Japan", "United States", "Samoa"] },
    { id: "F", label: "Pool F", teams: ["England", "Wales", "Tonga", "Zimbabwe"] },
  ],
};

export function isRugbyWorldCupSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RUGBY_WORLD_CUP_SLUGS.has(slug.trim().toLowerCase());
}

export function resolveRugbyWorldCupYear(input: {
  seasonYear?: number | null;
  seasonLabel?: string | null;
}): number | null {
  if (input.seasonYear != null && Number.isFinite(input.seasonYear)) {
    // Labels like 2023–24 store year=2023 for tournament seasons.
    return input.seasonYear;
  }
  const label = input.seasonLabel?.trim() ?? "";
  const match = label.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function rugbyWorldCupPoolsForYear(year: number | null | undefined): RugbyWorldCupPoolDefinition[] {
  if (year == null) return [];
  return POOLS_BY_YEAR[year] ?? [];
}

/** Nation keys that appeared in a given World Cup, or every finals since 1987. */
export function rugbyWorldCupParticipantKeys(year?: number | null): Set<string> {
  const years =
    year != null && POOLS_BY_YEAR[year]
      ? [year]
      : Object.keys(POOLS_BY_YEAR).map((value) => Number(value));
  const keys = new Set<string>();
  for (const y of years) {
    for (const pool of POOLS_BY_YEAR[y] ?? []) {
      for (const name of pool.teams) keys.add(teamKey(name));
    }
  }
  return keys;
}

export function isRugbyWorldCupParticipantName(
  teamName: string,
  year?: number | null,
): boolean {
  return rugbyWorldCupParticipantKeys(year).has(teamKey(teamName));
}

export function rugbyWorldCupPoolForTeam(
  year: number | null | undefined,
  teamName: string,
): RugbyWorldCupPoolDefinition | null {
  const pools = rugbyWorldCupPoolsForYear(year);
  const key = teamKey(teamName);
  for (const pool of pools) {
    if (pool.teams.some((name) => teamKey(name) === key)) return pool;
  }
  return null;
}

export function isWorldCupKnockoutStage(
  stage: string | null | undefined,
  round: string | null | undefined,
): boolean {
  const s = (stage ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const r = (round ?? "").toLowerCase();
  if (
    s.includes("quarter") ||
    s.includes("semi") ||
    s.includes("final") ||
    s.includes("playoff") ||
    s.includes("bronze") ||
    s.includes("round_of_16") ||
    s.includes("last_16")
  ) {
    // "pool stage" / "regular" are not knockouts even if "stage" field is odd.
    if (s === "regular" || s.includes("pool")) return false;
    return true;
  }
  return /quarter|semi[\s-]?final|bronze|3rd place|third place|play[\s-]?off|round of 16|last 16|^final$/i.test(
    r,
  );
}
