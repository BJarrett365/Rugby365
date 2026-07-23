/**
 * Pure helpers for Player Development Timeline (no DB / server-only).
 */

export type DevelopmentTimelinePoint = {
  fixtureId: string;
  fixtureSlug: string | null;
  date: string | null;
  seasonSlug: string | null;
  seasonLabel: string | null;
  competitionSlug: string | null;
  competitionName: string | null;
  teamName: string;
  opponentName: string | null;
  homeAway: "home" | "away" | null;
  result: "W" | "D" | "L" | null;
  resultLabel: string | null;
  scoreLine: string | null;
  positionName: string | null;
  jerseyNumber: number | null;
  started: boolean | null;
  minutes: number | null;
  rating: number | null;
  ratingChange: number | null;
  tries: number | null;
  points: number | null;
  carries: number | null;
  metresCarried: number | null;
  tacklesMade: number | null;
  isInternational: boolean;
  isPotm: boolean;
  modelVersion: string | null;
  annotations: DevelopmentAnnotation[];
};

export type DevelopmentAnnotation =
  | "try"
  | "multi_try"
  | "potm"
  | "yellow"
  | "red"
  | "intl"
  | "debut"
  | "transfer_debut"
  | "milestone";

export const ANNOTATION_LABELS: Record<DevelopmentAnnotation, string> = {
  try: "Try scored",
  multi_try: "Multiple tries",
  potm: "Player of the Match",
  yellow: "Yellow card",
  red: "Red card",
  intl: "International appearance",
  debut: "Debut",
  transfer_debut: "First match after transfer",
  milestone: "Career milestone",
};

export type DevelopmentTimelineFilters = {
  season: string;
  competition: string;
  scope: "all" | "domestic" | "international";
  role: "all" | "start" | "bench";
  venue: "all" | "home" | "away";
  result: "all" | "W" | "D" | "L";
  position: string; // "all" or position name
  team: string; // "all" or team name
};

export const DEFAULT_DEVELOPMENT_FILTERS: DevelopmentTimelineFilters = {
  season: "current",
  competition: "all",
  scope: "all",
  role: "all",
  venue: "all",
  result: "all",
  position: "all",
  team: "all",
};

export function rollingAverage(
  values: Array<number | null>,
  window = 5,
): Array<number | null> {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    const rated = slice.filter((v): v is number => v != null && Number.isFinite(v));
    if (rated.length === 0) return null;
    return rated.reduce((a, b) => a + b, 0) / rated.length;
  });
}

export function filterTimelinePoints(
  points: DevelopmentTimelinePoint[],
  filters: DevelopmentTimelineFilters,
  currentDomesticSlug: string,
  options: { minMinutes?: number } = {},
): DevelopmentTimelinePoint[] {
  const minMinutes = options.minMinutes ?? 0;
  return points.filter((p) => {
    if (minMinutes > 0 && (p.minutes == null || p.minutes < minMinutes)) return false;

    if (filters.season === "current") {
      if (p.seasonSlug !== currentDomesticSlug && p.seasonSlug !== String(new Date().getFullYear())) {
        // keep if null season only when nothing else? skip mismatches
        if (p.seasonSlug) return false;
      }
    } else if (filters.season !== "all" && p.seasonSlug !== filters.season) {
      return false;
    }

    if (filters.competition !== "all" && (p.competitionSlug ?? "").toLowerCase() !== filters.competition) {
      return false;
    }
    if (filters.scope === "domestic" && p.isInternational) return false;
    if (filters.scope === "international" && !p.isInternational) return false;
    if (filters.role === "start" && p.started !== true) return false;
    if (filters.role === "bench" && p.started !== false) return false;
    if (filters.venue !== "all" && p.homeAway !== filters.venue) return false;
    if (filters.result !== "all" && p.result !== filters.result) return false;
    if (filters.position !== "all") {
      if ((p.positionName ?? "").toLowerCase() !== filters.position.toLowerCase()) return false;
    }
    if (filters.team !== "all" && p.teamName.toLowerCase() !== filters.team.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export function summarizeRatedPoints(points: DevelopmentTimelinePoint[]) {
  const rated = points
    .filter((p) => p.rating != null && Number.isFinite(p.rating))
    .map((p) => ({ ...p, rating: p.rating as number }));
  if (!rated.length) {
    return {
      ratedAppearances: 0,
      average: null as number | null,
      highest: null as number | null,
      lowest: null as number | null,
      fiveMatchAverage: null as number | null,
      bestMatch: null as DevelopmentTimelinePoint | null,
      trendLabel: "Not enough data" as string,
      endRating: null as number | null,
    };
  }
  const values = rated.map((p) => p.rating);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  const lastFive = values.slice(-5);
  const fiveMatchAverage = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
  const bestMatch = rated.reduce((best, p) => (p.rating > best.rating ? p : best));
  const endRating = values[values.length - 1] ?? null;

  let trendLabel = "Not enough data";
  if (lastFive.length >= 2) {
    const delta = lastFive[lastFive.length - 1]! - lastFive[0]!;
    if (Math.abs(delta) < 0.05) trendLabel = "No change";
    else if (delta > 0) trendLabel = "Up";
    else trendLabel = "Down";
  }

  return {
    ratedAppearances: rated.length,
    average,
    highest,
    lowest,
    fiveMatchAverage,
    bestMatch,
    trendLabel,
    endRating,
  };
}

export type SeasonDevelopmentRow = {
  seasonSlug: string;
  seasonLabel: string;
  teamName: string;
  competitions: string[];
  ratedAppearances: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  endRating: number | null;
  changeFromPrevious: number | null;
};

export function buildSeasonDevelopmentRows(
  points: DevelopmentTimelinePoint[],
): SeasonDevelopmentRow[] {
  const bySeason = new Map<string, DevelopmentTimelinePoint[]>();
  for (const p of points) {
    if (!p.seasonSlug) continue;
    const list = bySeason.get(p.seasonSlug) ?? [];
    list.push(p);
    bySeason.set(p.seasonSlug, list);
  }

  const rows = [...bySeason.entries()]
    .map(([slug, list]) => {
      const summary = summarizeRatedPoints(list);
      const teams = [...new Set(list.map((p) => p.teamName))];
      const competitions = [
        ...new Set(list.map((p) => p.competitionName).filter(Boolean) as string[]),
      ];
      return {
        seasonSlug: slug,
        seasonLabel: list[0]?.seasonLabel ?? slug,
        teamName: teams.join(" / "),
        competitions,
        ratedAppearances: summary.ratedAppearances,
        average: summary.average,
        highest: summary.highest,
        lowest: summary.lowest,
        endRating: summary.endRating,
        changeFromPrevious: null as number | null,
      };
    })
    .sort((a, b) => a.seasonSlug.localeCompare(b.seasonSlug));

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]!.average;
    const curr = rows[i]!.average;
    rows[i]!.changeFromPrevious =
      prev != null && curr != null ? Number((curr - prev).toFixed(2)) : null;
  }

  return rows.reverse();
}

export function buildDevelopmentWrittenSummary(input: {
  playerName: string;
  points: DevelopmentTimelinePoint[];
  override?: string | null;
}): string {
  if (input.override?.trim()) return input.override.trim();
  const summary = summarizeRatedPoints(input.points);
  if (summary.ratedAppearances === 0) {
    return `${input.playerName} has no rated appearances in this selection.`;
  }
  const parts: string[] = [];
  if (summary.fiveMatchAverage != null && summary.ratedAppearances >= 2) {
    const n = Math.min(5, summary.ratedAppearances);
    parts.push(
      `${input.playerName} has averaged ${summary.fiveMatchAverage.toFixed(1)} across his last ${n} rated appearances.`,
    );
  } else if (summary.average != null) {
    parts.push(
      `${input.playerName} averages ${summary.average.toFixed(1)} across ${summary.ratedAppearances} rated appearances.`,
    );
  }
  if (summary.bestMatch?.opponentName && summary.bestMatch.date) {
    parts.push(
      `His highest rating in the selection came against ${summary.bestMatch.opponentName} on ${summary.bestMatch.date.slice(0, 10)} (${summary.highest?.toFixed(1)}).`,
    );
  }
  parts.push(`Trend: ${summary.trendLabel}.`);
  return parts.join(" ");
}

export function detectMixedModelVersions(points: DevelopmentTimelinePoint[]): boolean {
  const versions = new Set(
    points
      .map((p) => p.modelVersion)
      .filter((v): v is string => Boolean(v && v.trim())),
  );
  return versions.size > 1;
}

/** SVG path for rated points only — gaps (null ratings) break the line. */
export function buildGappedLinePath(
  coords: Array<{ x: number; y: number; rated: boolean }>,
): string {
  let d = "";
  let drawing = false;
  for (const c of coords) {
    if (!c.rated) {
      drawing = false;
      continue;
    }
    d += `${drawing ? "L" : "M"}${c.x.toFixed(1)},${c.y.toFixed(1)} `;
    drawing = true;
  }
  return d.trim();
}

export function annotationMarker(annotations: DevelopmentAnnotation[]): string {
  if (annotations.includes("potm")) return "★";
  if (annotations.includes("multi_try")) return "T×";
  if (annotations.includes("try")) return "T";
  if (annotations.includes("red")) return "R";
  if (annotations.includes("yellow")) return "Y";
  if (annotations.includes("intl")) return "I";
  if (annotations.includes("debut") || annotations.includes("transfer_debut")) return "1";
  if (annotations.includes("milestone")) return "M";
  return "";
}
