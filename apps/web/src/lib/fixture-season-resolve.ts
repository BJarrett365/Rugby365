/**
 * Pure season resolution helpers for fixtures.
 * Club: Jul–Jun cross-year. International/tournament: calendar (tournament) year.
 */

import {
  formatSeasonLabelForKind,
  kickoffInSeason,
  normalizeSeasonLabel,
  parseSeasonStartYear,
  seasonSlugForKind,
} from "./season-label-utils";

export { formatSeasonLabelForKind } from "./season-label-utils";

export const SEASON_STATUS_UNMAPPED = "SEASON_UNMAPPED" as const;

/** Rugby365 season kinds — permanent Rule Book types. */
export type SeasonKind = "club" | "international" | "tournament";

export type SeasonCandidate = {
  id: string;
  competitionId: string;
  label: string;
  year: number;
  isDeprecated?: boolean | null;
  isActive?: boolean | null;
};

export type FixtureSeasonResolveInput = {
  competitionId: string;
  kickoffAt: Date | string | null | undefined;
  /** Club | international | tournament — defaults to club (domestic/european). */
  seasonKind?: SeasonKind;
  /** Confirmed rugby_data / provider season mapping id */
  confirmedMappingSeasonId?: string | null;
  /** Existing confirmed provider season mapping id */
  confirmedProviderSeasonId?: string | null;
  /** Explicit season label from provider (e.g. sea: "2025/26") */
  providerSeasonLabel?: string | null;
  candidates: SeasonCandidate[];
};

export type FixtureSeasonResolveResult = {
  seasonId: string | null;
  startYear: number | null;
  label: string | null;
  confidence: number;
  reason: string;
  needsReview: boolean;
  status: "resolved" | typeof SEASON_STATUS_UNMAPPED;
  candidateIds: string[];
  seasonKind?: SeasonKind;
};

/** Map competition_type → Rule Book season kind. */
export function seasonKindFromCompetitionType(
  competitionType: string | null | undefined,
): SeasonKind {
  const t = (competitionType ?? "domestic").toLowerCase();
  if (t === "international") return "international";
  if (t === "world_cup" || t === "tournament") return "tournament";
  // domestic + european (Champions Cup etc.) → club cross-year
  return "club";
}

/** Jul–Jun domestic window start year from kickoff (not calendar year alone). */
export function domesticSeasonStartYearFromKickoff(kickoffAt: Date | string): number | null {
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  const month = kickoff.getMonth(); // 0 = Jan; Jul = 6
  const year = kickoff.getFullYear();
  return month >= 6 ? year : year - 1;
}

/** Calendar / tournament year from kickoff. */
export function calendarSeasonYearFromKickoff(kickoffAt: Date | string): number | null {
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  return kickoff.getFullYear();
}

export function seasonYearFromKickoff(
  kickoffAt: Date | string,
  kind: SeasonKind,
): number | null {
  return kind === "club"
    ? domesticSeasonStartYearFromKickoff(kickoffAt)
    : calendarSeasonYearFromKickoff(kickoffAt);
}

export function kickoffMatchesSeasonYear(
  kickoffAt: Date,
  year: number,
  kind: SeasonKind,
): boolean {
  if (kind === "club") return kickoffInSeason(kickoffAt, year);
  return kickoffAt.getFullYear() === year;
}

/**
 * Whether a fixture belongs to a season row.
 * Prefer explicit fixture.seasonId; otherwise use kickoff vs season kind
 * (club = Jul–Jun, international/tournament = calendar year).
 */
export function fixtureBelongsToSeason(input: {
  fixtureSeasonId: string | null | undefined;
  kickoffAt: Date | string | null | undefined;
  seasonId: string;
  seasonYear: number;
  seasonKind: SeasonKind;
}): boolean {
  if (input.fixtureSeasonId === input.seasonId) return true;
  if (input.fixtureSeasonId != null) return false;
  if (input.kickoffAt == null) return false;
  const kickoff =
    input.kickoffAt instanceof Date ? input.kickoffAt : new Date(input.kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return false;
  return kickoffMatchesSeasonYear(kickoff, input.seasonYear, input.seasonKind);
}

export function scoreSeasonCandidate(
  candidate: SeasonCandidate,
  kickoffAt: Date,
  preferredLabel: string | null,
  kind: SeasonKind = "club",
): number {
  if (candidate.isDeprecated) return -1;
  if (!kickoffMatchesSeasonYear(kickoffAt, candidate.year, kind)) return -1;

  let score = 50;
  if (kickoffMatchesSeasonYear(kickoffAt, candidate.year, kind)) score += 40;
  if (candidate.isActive) score += 5;
  if (preferredLabel) {
    const preferredYear = parseSeasonStartYear(preferredLabel);
    if (preferredYear === candidate.year) score += 20;
    const preferredNorm =
      kind === "club"
        ? normalizeSeasonLabel(preferredLabel)
        : preferredLabel.trim();
    const candidateNorm =
      kind === "club" ? normalizeSeasonLabel(candidate.label) : candidate.label.trim();
    if (preferredNorm && candidateNorm && preferredNorm === candidateNorm) score += 10;
  }
  if (kind === "club" && /^\d{4}\u2013\d{2}$/.test(candidate.label.trim())) score += 5;
  if (kind !== "club" && /^\d{4}$/.test(candidate.label.trim())) score += 5;
  return score;
}

/**
 * Resolve season using locked order:
 * 1. Confirmed Rugby Data mapping
 * 2. Confirmed provider mapping
 * 3. Competition + kickoff date among candidates (by season kind)
 * 4. Normalised provider season label among candidates
 * 5. Review if ambiguous / none
 */
export function resolveFixtureSeason(input: FixtureSeasonResolveInput): FixtureSeasonResolveResult {
  const kind = input.seasonKind ?? "club";
  const kickoff =
    input.kickoffAt == null
      ? null
      : input.kickoffAt instanceof Date
        ? input.kickoffAt
        : new Date(input.kickoffAt);

  if (!input.competitionId) {
    return unmapped("Competition required", null, kind);
  }

  if (input.confirmedMappingSeasonId?.trim()) {
    const id = input.confirmedMappingSeasonId.trim();
    const match = input.candidates.find((c) => c.id === id && c.competitionId === input.competitionId);
    if (match && !match.isDeprecated) {
      return {
        seasonId: match.id,
        startYear: match.year,
        label: match.label,
        confidence: 100,
        reason: "confirmed_rugby_data_season_mapping",
        needsReview: false,
        status: "resolved",
        candidateIds: [match.id],
        seasonKind: kind,
      };
    }
  }

  if (input.confirmedProviderSeasonId?.trim()) {
    const id = input.confirmedProviderSeasonId.trim();
    const match = input.candidates.find((c) => c.id === id && c.competitionId === input.competitionId);
    if (match && !match.isDeprecated) {
      return {
        seasonId: match.id,
        startYear: match.year,
        label: match.label,
        confidence: 95,
        reason: "confirmed_provider_season_mapping",
        needsReview: false,
        status: "resolved",
        candidateIds: [match.id],
        seasonKind: kind,
      };
    }
  }

  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    return unmapped("Kick-off required to resolve season", null, kind);
  }

  const startYear = seasonYearFromKickoff(kickoff, kind);
  const preferredLabel = (() => {
    if (input.providerSeasonLabel?.trim()) {
      if (kind === "club") return normalizeSeasonLabel(input.providerSeasonLabel) ?? input.providerSeasonLabel.trim();
      const y = parseSeasonStartYear(input.providerSeasonLabel) ?? Number(input.providerSeasonLabel.trim());
      return Number.isFinite(y) ? String(y) : input.providerSeasonLabel.trim();
    }
    return startYear != null ? formatSeasonLabelForKind(startYear, kind) : null;
  })();

  const active = input.candidates.filter(
    (c) => c.competitionId === input.competitionId && !c.isDeprecated,
  );

  const scored = active
    .map((c) => ({ c, score: scoreSeasonCandidate(c, kickoff, preferredLabel, kind) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  const inWindow = scored.filter((row) => kickoffMatchesSeasonYear(kickoff, row.c.year, kind));

  if (inWindow.length === 1) {
    const best = inWindow[0]!;
    return {
      seasonId: best.c.id,
      startYear: best.c.year,
      label: best.c.label,
      confidence: Math.min(94, best.score),
      reason: "competition_kickoff_unique",
      needsReview: false,
      status: "resolved",
      candidateIds: [best.c.id],
      seasonKind: kind,
    };
  }

  if (inWindow.length > 1) {
    const top = inWindow[0]!;
    const tied = inWindow.filter((r) => r.score === top.score);
    if (tied.length === 1) {
      return {
        seasonId: top.c.id,
        startYear: top.c.year,
        label: top.c.label,
        confidence: Math.min(80, top.score),
        reason: "competition_kickoff_best_of_duplicates",
        needsReview: true,
        status: "resolved",
        candidateIds: inWindow.map((r) => r.c.id),
        seasonKind: kind,
      };
    }
    return {
      seasonId: null,
      startYear,
      label: preferredLabel,
      confidence: 35,
      reason: "ambiguous_season_candidates",
      needsReview: true,
      status: SEASON_STATUS_UNMAPPED,
      candidateIds: inWindow.map((r) => r.c.id),
      seasonKind: kind,
    };
  }

  if (preferredLabel && startYear != null) {
    const byLabel = active.find((c) => {
      const y = parseSeasonStartYear(c.label) ?? c.year;
      return y === startYear && kickoffMatchesSeasonYear(kickoff, c.year, kind);
    });
    if (byLabel) {
      return {
        seasonId: byLabel.id,
        startYear: byLabel.year,
        label: byLabel.label,
        confidence: 70,
        reason: "normalised_provider_label",
        needsReview: false,
        status: "resolved",
        candidateIds: [byLabel.id],
        seasonKind: kind,
      };
    }
  }

  return {
    seasonId: null,
    startYear,
    label: preferredLabel,
    confidence: 20,
    reason: startYear == null ? "unresolvable_kickoff" : "no_matching_season_row",
    needsReview: true,
    status: SEASON_STATUS_UNMAPPED,
    candidateIds: [],
    seasonKind: kind,
  };
}

function unmapped(
  reason: string,
  startYear: number | null,
  kind: SeasonKind = "club",
): FixtureSeasonResolveResult {
  return {
    seasonId: null,
    startYear,
    label: startYear != null ? formatSeasonLabelForKind(startYear, kind) : null,
    confidence: 0,
    reason,
    needsReview: true,
    status: SEASON_STATUS_UNMAPPED,
    candidateIds: [],
    seasonKind: kind,
  };
}

export function proposedSeasonSlug(startYear: number, kind: SeasonKind = "club"): string {
  return seasonSlugForKind(startYear, kind);
}
