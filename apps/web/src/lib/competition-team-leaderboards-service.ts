import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { teamMatchStats, teams } from "@rugby365/db";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  listSeasonsForPicker,
  syncDomesticSeasonCatalog,
} from "./competition-admin-service";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";
import { parseSeasonStartYear, usesDomesticSeasonCatalog } from "./season-label-utils";
import { teamCodeForLeaderboard } from "./competition-player-stat-display";
import type { HemisphereFilter } from "./competition-player-leaderboards-service";
import {
  teamMatchScoringPoints,
  teamStatSectionNumber,
} from "./competition-team-stat-display";

export type TeamLeaderboardMetric =
  | "points"
  | "tries"
  | "tackles"
  | "metres"
  | "carries"
  | "offloads"
  | "turnoversWon"
  | "cleanBreaks"
  | "defendersBeaten"
  | "conversions"
  | "penalties";

export type CompetitionTeamLeaderboardEntry = {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamShortName: string | null;
  teamCode: string;
  teamImageUrl: string | null;
  value: number;
  matches: number;
  hemisphere: "northern" | "southern" | null;
};

export type CompetitionTeamLeaderboardBoard = {
  metric: TeamLeaderboardMetric;
  label: string;
  valueLabel: string;
  entries: CompetitionTeamLeaderboardEntry[];
};

export type CompetitionTeamStatsPayload = {
  competition: { id: string; slug: string; name: string };
  seasons: Array<{
    id: string;
    label: string;
    year: number;
    isActive: boolean;
    displayLabel?: string;
  }>;
  season: { id: string; label: string; year: number; isActive: boolean } | null;
  hemisphereFilter: HemisphereFilter;
  supportsHemisphereFilter: boolean;
  boards: CompetitionTeamLeaderboardBoard[];
  additionalBoards: CompetitionTeamLeaderboardBoard[];
  coverage: {
    teamCount: number;
    rowCount: number;
  };
};

export const TEAM_LEADERBOARD_VALUE_LABELS: Record<TeamLeaderboardMetric, string> = {
  points: "PTS",
  tries: "TRY",
  tackles: "TT",
  metres: "M",
  carries: "CAR",
  offloads: "OFF",
  turnoversWon: "TO",
  cleanBreaks: "CB",
  defendersBeaten: "DB",
  conversions: "CON",
  penalties: "PEN",
};

const PRIMARY_BOARDS: Array<{ metric: TeamLeaderboardMetric; label: string }> = [
  { metric: "points", label: "Most Points" },
  { metric: "tries", label: "Most Tries" },
  { metric: "tackles", label: "Most Tackles" },
  { metric: "metres", label: "Most Metres" },
  { metric: "carries", label: "Most Carries" },
  { metric: "offloads", label: "Most Offloads" },
];

const ADDITIONAL_BOARDS: Array<{ metric: TeamLeaderboardMetric; label: string }> = [
  { metric: "turnoversWon", label: "Most Turnovers Won" },
  { metric: "cleanBreaks", label: "Most Clean Breaks" },
  { metric: "defendersBeaten", label: "Most Defenders Beaten" },
  { metric: "conversions", label: "Most Conversions" },
  { metric: "penalties", label: "Most Penalties" },
];

type AggregatedTeam = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamShortName: string | null;
  teamImageUrl: string | null;
  matches: number;
  points: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  metres: number;
  carries: number;
  tackles: number;
  turnoversWon: number;
  offloads: number;
  cleanBreaks: number;
  defendersBeaten: number;
  hemisphere: "northern" | "southern" | null;
};

function sectionNumber(sections: unknown, path: string[]): number {
  return teamStatSectionNumber(sections, path);
}

function scoringPoints(row: {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
}): number {
  return teamMatchScoringPoints(row);
}

function emptyAgg(
  base: Omit<
    AggregatedTeam,
    | "matches"
    | "points"
    | "tries"
    | "conversions"
    | "penalties"
    | "dropGoals"
    | "metres"
    | "carries"
    | "tackles"
    | "turnoversWon"
    | "offloads"
    | "cleanBreaks"
    | "defendersBeaten"
  >,
): AggregatedTeam {
  return {
    ...base,
    matches: 0,
    points: 0,
    tries: 0,
    conversions: 0,
    penalties: 0,
    dropGoals: 0,
    metres: 0,
    carries: 0,
    tackles: 0,
    turnoversWon: 0,
    offloads: 0,
    cleanBreaks: 0,
    defendersBeaten: 0,
  };
}

function metricValue(row: AggregatedTeam, metric: TeamLeaderboardMetric): number {
  return row[metric] ?? 0;
}

function rankBoard(
  rows: AggregatedTeam[],
  metric: TeamLeaderboardMetric,
  label: string,
  limit: number,
): CompetitionTeamLeaderboardBoard {
  const ranked = [...rows]
    .map((row) => ({ row, value: metricValue(row, metric) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.row.matches !== a.row.matches) return b.row.matches - a.row.matches;
      return a.row.teamName.localeCompare(b.row.teamName);
    })
    .slice(0, limit);

  return {
    metric,
    label,
    valueLabel: TEAM_LEADERBOARD_VALUE_LABELS[metric],
    entries: ranked.map((entry, index) => ({
      rank: index + 1,
      teamId: entry.row.teamId,
      teamName: entry.row.teamName,
      teamSlug: entry.row.teamSlug,
      teamShortName: entry.row.teamShortName,
      teamCode: teamCodeForLeaderboard({
        teamName: entry.row.teamName,
        teamShortName: entry.row.teamShortName,
      }),
      teamImageUrl: entry.row.teamImageUrl,
      value: entry.value,
      matches: entry.row.matches,
      hemisphere: entry.row.hemisphere,
    })),
  };
}

async function resolveSeasonForCompetition(competitionId: string, seasonLabel?: string) {
  const seasons = await listSeasonsForPicker(competitionId);
  const active = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
  if (!seasonLabel?.trim()) return { seasons, season: active };

  const requested = seasonLabel.trim();
  const requestedYear = parseSeasonStartYear(requested);
  const match =
    seasons.find((s) => s.label === requested) ??
    seasons.find((s) => s.label.replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
    (requestedYear != null ? seasons.find((s) => s.year === requestedYear) : null) ??
    null;
  return { seasons, season: match };
}

function emptyPayload(
  competition: { id: string; slug: string; name: string },
  seasons: CompetitionTeamStatsPayload["seasons"],
  hemisphereFilter: HemisphereFilter,
  supportsHemisphereFilter: boolean,
): CompetitionTeamStatsPayload {
  return {
    competition,
    seasons,
    season: null,
    hemisphereFilter,
    supportsHemisphereFilter,
    boards: PRIMARY_BOARDS.map((b) => ({
      ...b,
      valueLabel: TEAM_LEADERBOARD_VALUE_LABELS[b.metric],
      entries: [],
    })),
    additionalBoards: ADDITIONAL_BOARDS.map((b) => ({
      ...b,
      valueLabel: TEAM_LEADERBOARD_VALUE_LABELS[b.metric],
      entries: [],
    })),
    coverage: { teamCount: 0, rowCount: 0 },
  };
}

export async function getCompetitionTeamStatsBySlug(
  slug: string,
  options: {
    seasonLabel?: string;
    hemisphere?: HemisphereFilter;
    limit?: number;
  } = {},
): Promise<CompetitionTeamStatsPayload | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  if (usesDomesticSeasonCatalog(competition.competitionType)) {
    await syncDomesticSeasonCatalog(competition.id);
  }

  const { seasons, season } = await resolveSeasonForCompetition(
    competition.id,
    options.seasonLabel,
  );
  const supportsHemisphereFilter = isNationsChampionshipSlug(competition.slug);
  const hemisphereFilter: HemisphereFilter =
    supportsHemisphereFilter && options.hemisphere ? options.hemisphere : "all";
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);

  const competitionMeta = {
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
  };

  if (!season) {
    return emptyPayload(competitionMeta, seasons, hemisphereFilter, supportsHemisphereFilter);
  }

  const db = getDb();
  const selectCols = {
    teamId: teamMatchStats.teamId,
    teamName: teams.name,
    teamSlug: teams.slug,
    teamShortName: teams.shortName,
    teamImageUrl: teams.imageUrl,
    tries: teamMatchStats.tries,
    conversions: teamMatchStats.conversions,
    penalties: teamMatchStats.penalties,
    dropGoals: teamMatchStats.dropGoals,
    metres: teamMatchStats.metres,
    carries: teamMatchStats.carries,
    tackles: teamMatchStats.tackles,
    turnoversWon: teamMatchStats.turnoversWon,
    sections: teamMatchStats.sections,
  };

  const rows = await db
    .select(selectCols)
    .from(teamMatchStats)
    .innerJoin(teams, eq(teamMatchStats.teamId, teams.id))
    .where(
      and(
        eq(teamMatchStats.competitionId, competition.id),
        eq(teamMatchStats.seasonId, season.id),
      ),
    )
    .orderBy(desc(teamMatchStats.syncedAt));

  // Strict season scope — never fall back to other seasons' team stats.
  const sourceRows = rows;
  const byTeam = new Map<string, AggregatedTeam>();

  for (const row of sourceRows) {
    const hemisphere = supportsHemisphereFilter
      ? nationsChampionshipHemisphereForTeam(row.teamName)
      : null;
    if (
      hemisphereFilter !== "all" &&
      supportsHemisphereFilter &&
      hemisphere !== hemisphereFilter
    ) {
      continue;
    }

    const existing = byTeam.get(row.teamId) ?? emptyAgg({
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      teamShortName: row.teamShortName,
      teamImageUrl: row.teamImageUrl,
      hemisphere,
    });

    const offloads = sectionNumber(row.sections, ["attack", "offloads"]);
    const cleanBreaks = sectionNumber(row.sections, ["attack", "clean_breaks"]);
    const defendersBeaten = sectionNumber(row.sections, ["attack", "defenders_beaten"]);
    const points = scoringPoints(row);

    existing.matches += 1;
    existing.points += points;
    existing.tries += row.tries;
    existing.conversions += row.conversions;
    existing.penalties += row.penalties;
    existing.dropGoals += row.dropGoals;
    existing.metres += row.metres;
    existing.carries += row.carries;
    existing.tackles += row.tackles;
    existing.turnoversWon += row.turnoversWon;
    existing.offloads += offloads;
    existing.cleanBreaks += cleanBreaks;
    existing.defendersBeaten += defendersBeaten;
    byTeam.set(row.teamId, existing);
  }

  const aggregated = [...byTeam.values()];

  return {
    competition: competitionMeta,
    seasons,
    season: {
      id: season.id,
      label: season.label,
      year: season.year,
      isActive: season.isActive,
    },
    hemisphereFilter,
    supportsHemisphereFilter,
    boards: PRIMARY_BOARDS.map((b) => rankBoard(aggregated, b.metric, b.label, limit)),
    additionalBoards: ADDITIONAL_BOARDS.map((b) =>
      rankBoard(aggregated, b.metric, b.label, limit),
    ),
    coverage: {
      teamCount: aggregated.length,
      rowCount: sourceRows.length,
    },
  };
}
