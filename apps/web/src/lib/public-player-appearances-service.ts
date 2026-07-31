/**
 * Player appearance ledger for public profiles — team-at-time from fixture_players.
 */
import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  isInternationalCompetitionType,
  seasonLabelToPublicSlug,
  type PublicPlayerView,
} from "./public-player-filters";
import {
  currentDomesticSeasonStartYear,
  formatSeasonRangeLabel,
  seasonSlugFromStartYear,
} from "./season-label-utils";

export type PublicAppearanceRow = {
  fixtureId: string;
  fixtureSlug: string | null;
  kickoffAt: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  seasonSlug: string | null;
  competitionId: string | null;
  competitionName: string | null;
  competitionSlug: string | null;
  competitionType: string | null;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  homeAway: "home" | "away" | null;
  homeScore: number | null;
  awayScore: number | null;
  result: "W" | "D" | "L" | null;
  resultLabel: string | null;
  started: boolean | null;
  squadRole: string | null;
  positionName: string | null;
  jerseyNumber: number | null;
  minutes: number | null;
  tries: number | null;
  points: number | null;
  carries: number | null;
  metresCarried: number | null;
  tacklesMade: number | null;
  turnoversWon: number | null;
  rating: number | null;
  isInternational: boolean;
};

export type PublicSeasonOption = {
  slug: string;
  label: string;
  appearanceCount: number;
};

export type PublicCompetitionOption = {
  slug: string;
  name: string;
  appearanceCount: number;
};

function resultFromScores(input: {
  teamId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}): { result: "W" | "D" | "L" | null; resultLabel: string | null; homeAway: "home" | "away" | null } {
  const { homeScore, awayScore, homeTeamId, awayTeamId, teamId } = input;
  const homeAway =
    teamId === homeTeamId ? "home" : teamId === awayTeamId ? "away" : null;
  if (homeScore == null || awayScore == null) {
    return { result: null, resultLabel: null, homeAway };
  }
  const scoreLine = `${homeScore}–${awayScore}`;
  const teamScore = homeAway === "home" ? homeScore : homeAway === "away" ? awayScore : null;
  const oppScore = homeAway === "home" ? awayScore : homeAway === "away" ? homeScore : null;
  if (teamScore == null || oppScore == null) {
    return { result: null, resultLabel: scoreLine, homeAway };
  }
  const result = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
  const word = result === "W" ? "Win" : result === "L" ? "Loss" : "Draw";
  return { result, resultLabel: `${word} ${scoreLine}`, homeAway };
}

function inferSeasonSlugFromKickoff(
  kickoffAt: Date | null,
  competitionType: string | null,
): { label: string; slug: string } | null {
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) return null;
  if (isInternationalCompetitionType(competitionType)) {
    const y = kickoffAt.getFullYear();
    return { label: String(y), slug: String(y) };
  }
  const start =
    kickoffAt.getMonth() >= 7 ? kickoffAt.getFullYear() : kickoffAt.getFullYear() - 1;
  return { label: formatSeasonRangeLabel(start), slug: seasonSlugFromStartYear(start) };
}

export async function loadPlayerAppearances(
  playerId: string,
  options: {
    view?: PublicPlayerView | "all";
    internationalTeamId?: string | null;
  } = {},
): Promise<PublicAppearanceRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: fixtures.id,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      seasonId: fixtures.seasonId,
      competitionId: fixtures.competitionId,
      competitionNameStored: fixtures.competitionName,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      teamId: fixturePlayers.teamId,
      squadRole: fixturePlayers.squadRole,
      positionName: fixturePlayers.positionName,
      jerseyNumber: fixturePlayers.jerseyNumber,
      tries: fixturePlayers.tries,
      points: fixturePlayers.points,
      seasonLabel: competitionSeasons.label,
      seasonSlugDb: competitionSeasons.slug,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.competitionType,
      teamName: teams.name,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitionSeasons, eq(fixtures.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt));

  if (!rows.length) return [];

  const fixtureIds = rows.map((r) => r.fixtureId);
  const [perfRows, ratingRows, opponentHome, opponentAway] = await Promise.all([
    db
      .select({
        fixtureId: playerMatchPerformanceStats.fixtureId,
        minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
        carries: playerMatchPerformanceStats.carries,
        metresCarried: playerMatchPerformanceStats.metresCarried,
        tacklesMade: playerMatchPerformanceStats.tacklesMade,
        turnoversWon: playerMatchPerformanceStats.turnoversWon,
      })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.playerId, playerId),
          inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
        ),
      ),
    db
      .select({
        fixtureId: playerMatchRatings.fixtureId,
        rating: playerMatchRatings.rating,
        minutesPlayed: playerMatchRatings.minutesPlayed,
      })
      .from(playerMatchRatings)
      .where(
        and(
          eq(playerMatchRatings.playerId, playerId),
          inArray(playerMatchRatings.fixtureId, fixtureIds),
        ),
      ),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(
        inArray(
          teams.id,
          [...new Set(rows.map((r) => r.awayTeamId).filter(Boolean) as string[])],
        ),
      ),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(
        inArray(
          teams.id,
          [...new Set(rows.map((r) => r.homeTeamId).filter(Boolean) as string[])],
        ),
      ),
  ]);

  const perfByFixture = new Map(perfRows.map((p) => [p.fixtureId, p]));
  const ratingByFixture = new Map(ratingRows.map((r) => [r.fixtureId, r]));
  const teamNameById = new Map<string, string>();
  for (const t of [...opponentHome, ...opponentAway]) teamNameById.set(t.id, t.name);

  const intlTeamId = options.internationalTeamId ?? null;
  const view = options.view ?? "domestic";

  const mapped: PublicAppearanceRow[] = rows.map((r) => {
    const kickoff = r.kickoffAt ? new Date(r.kickoffAt) : null;
    const competitionType = r.competitionType;
    const isIntl =
      isInternationalCompetitionType(competitionType) ||
      (intlTeamId != null && r.teamId === intlTeamId);

    let seasonLabel = r.seasonLabel;
    let seasonSlug =
      seasonLabelToPublicSlug(r.seasonLabel) ??
      (r.seasonSlugDb && /^\d{4}(-\d{2})?$/.test(r.seasonSlugDb) ? r.seasonSlugDb : null);

    if (!seasonSlug) {
      const inferred = inferSeasonSlugFromKickoff(kickoff, competitionType);
      if (inferred) {
        seasonLabel = seasonLabel ?? inferred.label;
        seasonSlug = inferred.slug;
      }
    }

    const { result, resultLabel, homeAway } = resultFromScores({
      teamId: r.teamId,
      homeTeamId: r.homeTeamId,
      awayTeamId: r.awayTeamId,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });

    const opponentId =
      homeAway === "home" ? r.awayTeamId : homeAway === "away" ? r.homeTeamId : null;
    const perf = perfByFixture.get(r.fixtureId);
    const rating = ratingByFixture.get(r.fixtureId);
    const role = (r.squadRole ?? "").toLowerCase();
    const started =
      role.includes("start") || role === "15" || role === "starter"
        ? true
        : role.includes("bench") || role.includes("repl") || role === "reserve"
          ? false
          : null;

    return {
      fixtureId: r.fixtureId,
      fixtureSlug: r.fixtureSlug,
      kickoffAt: kickoff?.toISOString() ?? null,
      seasonId: r.seasonId,
      seasonLabel,
      seasonSlug,
      competitionId: r.competitionId,
      competitionName: r.competitionName ?? r.competitionNameStored,
      competitionSlug: r.competitionSlug,
      competitionType,
      teamId: r.teamId,
      teamName: r.teamName,
      opponentName: opponentId ? teamNameById.get(opponentId) ?? null : null,
      homeAway,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      result,
      resultLabel,
      started,
      squadRole: r.squadRole,
      positionName: r.positionName,
      jerseyNumber: r.jerseyNumber,
      minutes: rating?.minutesPlayed ?? perf?.minutesPlayed ?? null,
      tries: r.tries,
      points: r.points,
      carries: perf?.carries ?? null,
      metresCarried: perf?.metresCarried ?? null,
      tacklesMade: perf?.tacklesMade ?? null,
      turnoversWon: perf?.turnoversWon ?? null,
      rating: rating?.rating ?? null,
      isInternational: isIntl,
    };
  });

  if (view === "international") return mapped.filter((a) => a.isInternational);
  if (view === "domestic") return mapped.filter((a) => !a.isInternational);
  return mapped;
}

export function filterAppearances(
  rows: PublicAppearanceRow[],
  input: {
    season: string;
    competition: string;
    currentDomesticSlug?: string;
  },
): PublicAppearanceRow[] {
  const current =
    input.currentDomesticSlug ?? seasonSlugFromStartYear(currentDomesticSeasonStartYear());
  return rows.filter((row) => {
    if (input.season === "all") {
      // include
    } else if (input.season === "current") {
      if (row.seasonSlug !== current) return false;
    } else if (row.seasonSlug !== input.season) {
      return false;
    }
    if (input.competition !== "all") {
      if ((row.competitionSlug ?? "").toLowerCase() !== input.competition) return false;
    }
    return true;
  });
}

export function buildSeasonOptions(rows: PublicAppearanceRow[]): PublicSeasonOption[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    if (!row.seasonSlug) continue;
    const prev = map.get(row.seasonSlug);
    map.set(row.seasonSlug, {
      label: row.seasonLabel ?? row.seasonSlug,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...map.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, appearanceCount: v.count }))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

export function buildCompetitionOptions(rows: PublicAppearanceRow[]): PublicCompetitionOption[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    if (!row.competitionSlug) continue;
    const prev = map.get(row.competitionSlug);
    map.set(row.competitionSlug, {
      name: row.competitionName ?? row.competitionSlug,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...map.entries()]
    .map(([slug, v]) => ({ slug, name: v.name, appearanceCount: v.count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeAppearances(rows: PublicAppearanceRow[]) {
  const apps = rows.length;
  const starts = rows.filter((r) => r.started === true).length;
  const bench = rows.filter((r) => r.started === false).length;
  const sum = (key: keyof PublicAppearanceRow) => {
    let total = 0;
    let seen = false;
    for (const r of rows) {
      const v = r[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        total += v;
        seen = true;
      }
    }
    return seen ? total : null;
  };
  const minutes = sum("minutes");
  const tries = sum("tries");
  const points = sum("points");
  const carries = sum("carries");
  const metres = sum("metresCarried");
  const tackles = sum("tacklesMade");
  const turnovers = sum("turnoversWon");
  const rated = rows.filter((r) => r.rating != null);
  const ratingAvg =
    rated.length > 0
      ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length
      : null;

  const seasonLabel =
    rows[0]?.seasonLabel ??
    (rows.length ? "Selected period" : formatSeasonRangeLabel(currentDomesticSeasonStartYear()));

  return {
    seasonLabel,
    appearances: apps > 0 ? apps : null,
    starts: apps > 0 ? starts : null,
    bench: apps > 0 ? bench : null,
    minutesPlayed: minutes,
    tries,
    points,
    tryAssists: null as number | null,
    carries,
    metresCarried: metres,
    tacklesMade: tackles,
    tacklesCompleted: null as number | null,
    turnoversWon: turnovers,
    lineBreaks: null as number | null,
    defendersBeaten: null as number | null,
    attackRank: null as number | null,
    defenceRank: null as number | null,
    ratingAverage: ratingAvg,
    ratedAppearances: rated.length,
  };
}

export function latestRecordedClubSeason(rows: PublicAppearanceRow[]): {
  teamName: string;
  seasonLabel: string;
  seasonSlug: string;
} | null {
  const club = rows.find((r) => !r.isInternational && r.seasonSlug && r.teamName);
  if (!club?.seasonSlug) return null;
  return {
    teamName: club.teamName,
    seasonLabel: club.seasonLabel ?? club.seasonSlug,
    seasonSlug: club.seasonSlug,
  };
}

export async function resolveCurrentClubCompetitionName(clubTeamId: string | null): Promise<string | null> {
  if (!clubTeamId) return null;
  const db = getDb();
  const [row] = await db
    .select({
      name: competitions.name,
    })
    .from(fixtures)
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        sql`(${fixtures.homeTeamId} = ${clubTeamId} OR ${fixtures.awayTeamId} = ${clubTeamId})`,
        eq(competitions.competitionType, "domestic"),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  return row?.name ?? null;
}

export function positionBreakdown(rows: PublicAppearanceRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const pos = row.positionName?.trim();
    if (!pos) continue;
    map.set(pos, (map.get(pos) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([position, appearances]) => ({ position, appearances }))
    .sort((a, b) => b.appearances - a.appearances);
}
