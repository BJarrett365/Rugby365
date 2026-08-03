import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  coachMatchRatings,
  coaches,
  fixtures,
  playerMatchRatings,
  players,
  refereeMatchRatings,
  referees,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  listSeasonsForPicker,
  syncDomesticSeasonCatalog,
} from "./competition-admin-service";
import {
  RANKING_POSITION_LABELS,
  average,
  isProvisional,
  rankingPositionGroup,
  rankingTrend,
  rating10To100,
  refereeDifficultyAdjustment,
  tournamentRatingFromMatches,
  type RankingPositionGroup,
  type RankingTrend,
} from "./competition-ranking-math";
import { parseSeasonStartYear, usesDomesticSeasonCatalog } from "./season-label-utils";
import { teamCodeForLeaderboard } from "./competition-player-stat-display";
import { backfillStaffMatchRatingsForCompetitionSeason } from "./staff-match-rating-service";

export type CompetitionRankingsTab = "players" | "teams" | "referees" | "coaches";

export type CompetitionPlayerRankingRow = {
  rank: number;
  provisional: boolean;
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamCode: string | null;
  teamRank: number | null;
  positionGroup: RankingPositionGroup;
  positionLabel: string;
  matches: number;
  avgRating: number;
  bestRating: number;
  trend: RankingTrend;
};

export type CompetitionPlayerPositionBoard = {
  positionGroup: RankingPositionGroup;
  label: string;
  entries: CompetitionPlayerRankingRow[];
};

export type CompetitionTeamRankingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamCode: string;
  teamImageUrl: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsDiff: number;
  points: number;
  form: string | null;
};

export type CompetitionRefereeRankingRow = {
  rank: number;
  provisional: boolean;
  refereeId: string;
  refereeName: string;
  refereeSlug: string;
  matches: number;
  avgRating: number;
  tournamentRating: number;
  bestRating: number;
  trend: RankingTrend;
  cardsIssued: number | null;
};

export type CompetitionCoachRankingRow = {
  rank: number;
  provisional: boolean;
  coachId: string;
  coachName: string;
  coachSlug: string;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamCode: string | null;
  matches: number;
  wins: number;
  winRate: number;
  avgRating: number;
  tournamentRating: number;
  bestRating: number;
  trend: RankingTrend;
};

export type CompetitionRankingsPayload = {
  competition: { id: string; slug: string; name: string };
  seasons: Array<{
    id: string;
    label: string;
    year: number;
    isActive: boolean;
    displayLabel?: string;
  }>;
  season: { id: string; label: string; year: number; isActive: boolean } | null;
  notes: {
    players: string;
    referees: string;
    coaches: string;
  };
  playersByPosition: CompetitionPlayerPositionBoard[];
  teams: CompetitionTeamRankingRow[];
  referees: CompetitionRefereeRankingRow[];
  coaches: CompetitionCoachRankingRow[];
  coverage: {
    playerRatedMatches: number;
    refereeRatedMatches: number;
    coachRatedMatches: number;
  };
};

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

function effectiveStaffRating(row: {
  rating: number | null;
  manualOverrideRating: number | null;
  ratingStatus: string;
}): number | null {
  if (row.manualOverrideRating != null && Number.isFinite(row.manualOverrideRating)) {
    return row.manualOverrideRating;
  }
  const status = row.ratingStatus.toLowerCase();
  if (
    status !== "available" &&
    status !== "override" &&
    status !== "final" &&
    status !== "published"
  ) {
    return null;
  }
  if (row.rating == null || !Number.isFinite(row.rating)) return null;
  return row.rating;
}

export async function getCompetitionRankingsBySlug(
  slug: string,
  options: { seasonLabel?: string; limit?: number } = {},
): Promise<CompetitionRankingsPayload | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  if (usesDomesticSeasonCatalog(competition.competitionType)) {
    await syncDomesticSeasonCatalog(competition.id);
  }

  const { seasons, season } = await resolveSeasonForCompetition(
    competition.id,
    options.seasonLabel,
  );
  const limit = Math.min(Math.max(options.limit ?? 10, 3), 40);
  const notes = {
    players:
      "Ranked by average Rugby365 match rating within this competition season, grouped by position. Team rank is the club’s current table place.",
    referees:
      "Tournament rating = average match rating (/100) plus difficulty bonus for close / knockout games when the performance is strong (≥75). Provisional until 2 matches.",
    coaches:
      "Tournament rating = average match rating (/100). Wins and win-rate shown for context. Provisional until 2 matches. Full expectation-adjusted model expands as more squad-strength data is wired.",
  };

  const empty: CompetitionRankingsPayload = {
    competition: { id: competition.id, slug: competition.slug, name: competition.name },
    seasons,
    season: season
      ? { id: season.id, label: season.label, year: season.year, isActive: season.isActive }
      : null,
    notes,
    playersByPosition: [],
    teams: [],
    referees: [],
    coaches: [],
    coverage: { playerRatedMatches: 0, refereeRatedMatches: 0, coachRatedMatches: 0 },
  };

  if (!season) return empty;

  // Fill missing coach/referee links + match ratings so tournament boards are complete.
  try {
    await backfillStaffMatchRatingsForCompetitionSeason(competition.id, season.id);
  } catch (error) {
    console.warn(
      `[competition-rankings] staff backfill failed for ${competition.slug}/${season.label}:`,
      error instanceof Error ? error.message : error,
    );
  }

  const db = getDb();

  // ── Teams (from finished fixtures) ───────────────────────────────────────
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
      round: fixtures.round,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, competition.id),
        eq(fixtures.seasonId, season.id),
        inArray(fixtures.status, ["full_time", "finished", "result"]),
      ),
    );

  const teamIds = [
    ...new Set(
      fixtureRows
        .flatMap((f) => [f.homeTeamId, f.awayTeamId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const teamMetaRows =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            shortName: teams.shortName,
            imageUrl: teams.imageUrl,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds));
  const teamMeta = new Map(teamMetaRows.map((t) => [t.id, t]));

  type TeamAgg = {
    teamId: string;
    teamName: string;
    teamSlug: string;
    teamShortName: string | null;
    teamImageUrl: string | null;
    played: number;
    won: number;
    draw: number;
    lost: number;
    pf: number;
    pa: number;
  };
  const teamMap = new Map<string, TeamAgg>();
  function touchTeam(id: string | null) {
    if (!id) return null;
    const existing = teamMap.get(id);
    if (existing) return existing;
    const meta = teamMeta.get(id);
    if (!meta) return null;
    const row: TeamAgg = {
      teamId: id,
      teamName: meta.name,
      teamSlug: meta.slug,
      teamShortName: meta.shortName,
      teamImageUrl: meta.imageUrl,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pf: 0,
      pa: 0,
    };
    teamMap.set(id, row);
    return row;
  }

  for (const fx of fixtureRows) {
    const home = touchTeam(fx.homeTeamId);
    const away = touchTeam(fx.awayTeamId);
    if (!home || !away) continue;
    const hs = fx.homeScore ?? 0;
    const as = fx.awayScore ?? 0;
    home.played += 1;
    away.played += 1;
    home.pf += hs;
    home.pa += as;
    away.pf += as;
    away.pa += hs;
    if (hs > as) {
      home.won += 1;
      away.lost += 1;
    } else if (as > hs) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
    }
  }

  const teamsRanked = [...teamMap.values()]
    .map((t) => ({
      ...t,
      points: t.won * 4 + t.draw * 2,
      pointsDiff: t.pf - t.pa,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return a.teamName.localeCompare(b.teamName);
    });

  const teamRankById = new Map<string, number>();
  const teamRows: CompetitionTeamRankingRow[] = teamsRanked.map((t, i) => {
    teamRankById.set(t.teamId, i + 1);
    return {
      rank: i + 1,
      teamId: t.teamId,
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      teamCode: teamCodeForLeaderboard({
        teamName: t.teamName,
        teamShortName: t.teamShortName,
      }),
      teamImageUrl: t.teamImageUrl,
      played: t.played,
      won: t.won,
      draw: t.draw,
      lost: t.lost,
      pointsDiff: t.pointsDiff,
      points: t.points,
      form: null,
    };
  });

  // ── Players by position ──────────────────────────────────────────────────
  const playerRows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      playerName: players.name,
      playerSlug: players.slug,
      playerImageUrl: players.imageUrl,
      teamId: playerMatchRatings.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      positionName: playerMatchRatings.positionName,
      playerPositionName: players.positionName,
      rating: playerMatchRatings.rating,
      ratingStatus: playerMatchRatings.ratingStatus,
      manualOverrideRating: playerMatchRatings.manualOverrideRating,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(playerMatchRatings)
    .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
    .leftJoin(teams, eq(playerMatchRatings.teamId, teams.id))
    .leftJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        eq(playerMatchRatings.competitionId, competition.id),
        eq(playerMatchRatings.seasonId, season.id),
        isNotNull(playerMatchRatings.rating),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  type PlayerAgg = {
    playerId: string;
    playerName: string;
    playerSlug: string;
    playerImageUrl: string | null;
    teamId: string | null;
    teamName: string | null;
    teamSlug: string | null;
    teamShortName: string | null;
    positionGroup: RankingPositionGroup;
    ratings: number[];
  };
  const playerMap = new Map<string, PlayerAgg>();
  for (const row of playerRows) {
    const r10 =
      row.manualOverrideRating != null && Number.isFinite(row.manualOverrideRating)
        ? row.manualOverrideRating
        : row.rating;
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    const pos = rankingPositionGroup(row.positionName ?? row.playerPositionName);
    const key = `${row.playerId}:${pos}`;
    const existing = playerMap.get(key) ?? {
      playerId: row.playerId,
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      playerImageUrl: row.playerImageUrl,
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      teamShortName: row.teamShortName,
      positionGroup: pos,
      ratings: [],
    };
    existing.ratings.push(r100);
    if (row.teamId) {
      existing.teamId = row.teamId;
      existing.teamName = row.teamName;
      existing.teamSlug = row.teamSlug;
      existing.teamShortName = row.teamShortName;
    }
    playerMap.set(key, existing);
  }

  const positionOrder: RankingPositionGroup[] = [
    "props",
    "hookers",
    "locks",
    "back_row",
    "scrum_halves",
    "fly_halves",
    "centres",
    "wings",
    "full_backs",
  ];

  const playersByPosition: CompetitionPlayerPositionBoard[] = positionOrder.map((group) => {
    const entries = [...playerMap.values()]
      .filter((p) => p.positionGroup === group)
      .map((p) => {
        const avg = average(p.ratings) ?? 0;
        const recent = p.ratings.slice(0, 3);
        const older = p.ratings.slice(3);
        return {
          provisional: isProvisional(p.ratings.length),
          playerId: p.playerId,
          playerName: p.playerName,
          playerSlug: p.playerSlug,
          playerImageUrl: p.playerImageUrl,
          teamId: p.teamId,
          teamName: p.teamName,
          teamSlug: p.teamSlug,
          teamCode: p.teamName
            ? teamCodeForLeaderboard({
                teamName: p.teamName,
                teamShortName: p.teamShortName,
              })
            : null,
          teamRank: p.teamId ? (teamRankById.get(p.teamId) ?? null) : null,
          positionGroup: group,
          positionLabel: RANKING_POSITION_LABELS[group],
          matches: p.ratings.length,
          avgRating: avg,
          bestRating: Math.max(...p.ratings),
          trend: rankingTrend(recent, older),
        };
      })
      .sort((a, b) => {
        if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        if (b.matches !== a.matches) return b.matches - a.matches;
        return a.playerName.localeCompare(b.playerName);
      })
      .slice(0, limit)
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return {
      positionGroup: group,
      label: RANKING_POSITION_LABELS[group],
      entries,
    };
  }).filter((board) => board.entries.length > 0);

  // ── Referees ─────────────────────────────────────────────────────────────
  const refRows = await db
    .select({
      refereeId: refereeMatchRatings.refereeId,
      refereeName: referees.name,
      refereeSlug: referees.slug,
      rating: refereeMatchRatings.rating,
      ratingStatus: refereeMatchRatings.ratingStatus,
      manualOverrideRating: refereeMatchRatings.manualOverrideRating,
      performanceTrend: refereeMatchRatings.performanceTrend,
      round: fixtures.round,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(refereeMatchRatings)
    .innerJoin(referees, eq(refereeMatchRatings.refereeId, referees.id))
    .leftJoin(fixtures, eq(refereeMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        eq(refereeMatchRatings.competitionId, competition.id),
        eq(refereeMatchRatings.seasonId, season.id),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  type RefAgg = {
    refereeId: string;
    refereeName: string;
    refereeSlug: string;
    ratings100: number[];
    bonuses: number[];
  };
  const refMap = new Map<string, RefAgg>();
  for (const row of refRows) {
    const r10 = effectiveStaffRating(row);
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    const margin =
      row.homeScore != null && row.awayScore != null
        ? Math.abs(row.homeScore - row.awayScore)
        : null;
    const bonus = refereeDifficultyAdjustment({
      rating100: r100,
      round: row.round,
      margin,
    });
    const existing = refMap.get(row.refereeId) ?? {
      refereeId: row.refereeId,
      refereeName: row.refereeName,
      refereeSlug: row.refereeSlug,
      ratings100: [],
      bonuses: [],
    };
    existing.ratings100.push(r100);
    existing.bonuses.push(bonus);
    refMap.set(row.refereeId, existing);
  }

  const refereeRankings: CompetitionRefereeRankingRow[] = [...refMap.values()]
    .map((r) => {
      const avg = average(r.ratings100) ?? 0;
      const tournament = tournamentRatingFromMatches(r.ratings100, r.bonuses) ?? avg;
      return {
        provisional: isProvisional(r.ratings100.length),
        refereeId: r.refereeId,
        refereeName: r.refereeName,
        refereeSlug: r.refereeSlug,
        matches: r.ratings100.length,
        avgRating: avg,
        tournamentRating: tournament,
        bestRating: Math.max(...r.ratings100),
        trend: rankingTrend(r.ratings100.slice(0, 3), r.ratings100.slice(3)),
        cardsIssued: null,
      };
    })
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.tournamentRating !== a.tournamentRating) return b.tournamentRating - a.tournamentRating;
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return a.refereeName.localeCompare(b.refereeName);
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // ── Coaches ──────────────────────────────────────────────────────────────
  const coachRows = await db
    .select({
      coachId: coachMatchRatings.coachId,
      coachName: coaches.name,
      coachSlug: coaches.slug,
      teamId: coachMatchRatings.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      side: coachMatchRatings.side,
      rating: coachMatchRatings.rating,
      ratingStatus: coachMatchRatings.ratingStatus,
      manualOverrideRating: coachMatchRatings.manualOverrideRating,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(coachMatchRatings)
    .innerJoin(coaches, eq(coachMatchRatings.coachId, coaches.id))
    .leftJoin(teams, eq(coachMatchRatings.teamId, teams.id))
    .leftJoin(fixtures, eq(coachMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        eq(coachMatchRatings.competitionId, competition.id),
        eq(coachMatchRatings.seasonId, season.id),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  type CoachAgg = {
    coachId: string;
    coachName: string;
    coachSlug: string;
    teamId: string | null;
    teamName: string | null;
    teamSlug: string | null;
    teamShortName: string | null;
    ratings100: number[];
    wins: number;
    matches: number;
  };
  const coachMap = new Map<string, CoachAgg>();
  for (const row of coachRows) {
    const r10 = effectiveStaffRating(row);
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    const existing = coachMap.get(row.coachId) ?? {
      coachId: row.coachId,
      coachName: row.coachName,
      coachSlug: row.coachSlug,
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      teamShortName: row.teamShortName,
      ratings100: [],
      wins: 0,
      matches: 0,
    };
    existing.ratings100.push(r100);
    existing.matches += 1;
    if (row.homeScore != null && row.awayScore != null) {
      const forScore = row.side === "home" ? row.homeScore : row.awayScore;
      const against = row.side === "home" ? row.awayScore : row.homeScore;
      if (forScore > against) existing.wins += 1;
    }
    if (row.teamId) {
      existing.teamId = row.teamId;
      existing.teamName = row.teamName;
      existing.teamSlug = row.teamSlug;
      existing.teamShortName = row.teamShortName;
    }
    coachMap.set(row.coachId, existing);
  }

  const coachRankings: CompetitionCoachRankingRow[] = [...coachMap.values()]
    .map((c) => {
      const avg = average(c.ratings100) ?? 0;
      return {
        provisional: isProvisional(c.ratings100.length),
        coachId: c.coachId,
        coachName: c.coachName,
        coachSlug: c.coachSlug,
        teamId: c.teamId,
        teamName: c.teamName,
        teamSlug: c.teamSlug,
        teamCode: c.teamName
          ? teamCodeForLeaderboard({
              teamName: c.teamName,
              teamShortName: c.teamShortName,
            })
          : null,
        matches: c.matches,
        wins: c.wins,
        winRate: c.matches ? Math.round((c.wins / c.matches) * 1000) / 10 : 0,
        avgRating: avg,
        tournamentRating: avg,
        bestRating: Math.max(...c.ratings100),
        trend: rankingTrend(c.ratings100.slice(0, 3), c.ratings100.slice(3)),
      };
    })
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.tournamentRating !== a.tournamentRating) return b.tournamentRating - a.tournamentRating;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.coachName.localeCompare(b.coachName);
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));

  return {
    ...empty,
    season: {
      id: season.id,
      label: season.label,
      year: season.year,
      isActive: season.isActive,
    },
    playersByPosition,
    teams: teamRows,
    referees: refereeRankings,
    coaches: coachRankings,
    coverage: {
      playerRatedMatches: playerRows.length,
      refereeRatedMatches: refRows.length,
      coachRatedMatches: coachRows.length,
    },
  };
}
