/**
 * Player Career V2 — aggregates fixtures, performance stats, stints, and achievements.
 */
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerCareerStints,
  playerMatchPerformanceStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { isInternationalCompetitionType } from "./public-player-filters";
import {
  buildPublicPlayerCareerV2,
  type CareerAchievementInput,
  type CareerMatchInput,
} from "./public-player-career-v2-math";
import type { PublicPlayerCareerV2Dto } from "./public-player-career-v2-types";
import { extraNumber, isCompletedMatchStatus, rugbySeasonLabelFromStart, rugbySeasonStartFromKickoff } from "./public-player-stats-v2-math";
import {
  isUnknownStandingsTeamName,
  resolveTeamNamesFromFixtureSlug,
} from "./table-lab/standings-fixture-dedupe";

function resultFromScores(
  teamId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
  homeScore: number | null,
  awayScore: number | null,
): "W" | "D" | "L" | null {
  const isHome = teamId === homeTeamId;
  const isAway = teamId === awayTeamId;
  if (homeScore == null || awayScore == null || (!isHome && !isAway)) return null;
  const scoreFor = isHome ? homeScore : awayScore;
  const scoreAgainst = isHome ? awayScore : homeScore;
  if (scoreFor > scoreAgainst) return "W";
  if (scoreFor < scoreAgainst) return "L";
  return "D";
}

export async function getPublicPlayerCareerV2(
  playerId: string,
  opts?: {
    verifiedCaps?: number | null;
    internationalTeamName?: string | null;
    achievements?: CareerAchievementInput[];
    dataAsOfIso?: string | null;
  },
): Promise<PublicPlayerCareerV2Dto | null> {
  const db = getDb();
  const [player] = await db
    .select({
      id: players.id,
      internationalTeamId: players.internationalTeamId,
      verifiedInternationalCaps: players.verifiedInternationalCaps,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) return null;

  const homeTeams = alias(teams, "pcareer_home");
  const awayTeams = alias(teams, "pcareer_away");
  const playerTeam = alias(teams, "pcareer_side");

  const fpRows = await db
    .select({
      fixtureId: fixtures.id,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionId: fixtures.competitionId,
      competitionNameStored: fixtures.competitionName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      competitionName: competitions.name,
      competitionType: competitions.competitionType,
      teamId: fixturePlayers.teamId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
      positionName: fixturePlayers.positionName,
      tries: fixturePlayers.tries,
      conversions: fixturePlayers.conversions,
      penalties: fixturePlayers.penalties,
      dropGoals: fixturePlayers.dropGoals,
      points: fixturePlayers.points,
      teamName: playerTeam.name,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeCountry: homeTeams.countryName,
      awayCountry: awayTeams.countryName,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .innerJoin(playerTeam, eq(fixturePlayers.teamId, playerTeam.id))
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt));

  const fixtureIds = fpRows.map((r) => r.fixtureId);
  const perfRows = fixtureIds.length
    ? await db
        .select({
          fixtureId: playerMatchPerformanceStats.fixtureId,
          minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
          tryAssists: playerMatchPerformanceStats.tryAssists,
          lineBreaks: playerMatchPerformanceStats.lineBreaks,
          defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
          tacklesMade: playerMatchPerformanceStats.tacklesMade,
          extras: playerMatchPerformanceStats.extras,
          tries: playerMatchPerformanceStats.tries,
          points: playerMatchPerformanceStats.points,
        })
        .from(playerMatchPerformanceStats)
        .where(
          and(
            eq(playerMatchPerformanceStats.playerId, playerId),
            inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
          ),
        )
    : [];

  const perfByFixture = new Map(perfRows.map((p) => [p.fixtureId, p]));

  const matches: CareerMatchInput[] = [];
  const seen = new Set<string>();
  for (const row of fpRows) {
    if (seen.has(row.fixtureId)) continue;
    seen.add(row.fixtureId);
    const perf = perfByFixture.get(row.fixtureId) ?? null;
    const extras = perf?.extras ?? null;
    const competitionName = row.competitionName ?? row.competitionNameStored;
    const isInternational =
      (player.internationalTeamId != null && row.teamId === player.internationalTeamId) ||
      isInternationalCompetitionType(row.competitionType);
    const resolved = resolveTeamNamesFromFixtureSlug(
      row.fixtureSlug,
      row.homeTeamName ?? "",
      row.awayTeamName ?? "",
    );
    let teamName = row.teamName;
    if (isUnknownStandingsTeamName(teamName)) {
      if (row.teamId === row.homeTeamId) teamName = resolved.homeName;
      else if (row.teamId === row.awayTeamId) teamName = resolved.awayName;
    }
    let opponentName =
      row.teamId === row.homeTeamId
        ? resolved.awayName || row.awayTeamName
        : row.teamId === row.awayTeamId
          ? resolved.homeName || row.homeTeamName
          : null;
    if (opponentName && isUnknownStandingsTeamName(opponentName)) opponentName = null;
    const opponentCountryName =
      row.teamId === row.homeTeamId
        ? row.awayCountry
        : row.teamId === row.awayTeamId
          ? row.homeCountry
          : null;
    const seasonStart = row.kickoffAt ? rugbySeasonStartFromKickoff(row.kickoffAt) : null;
    matches.push({
      fixtureId: row.fixtureId,
      kickoffAt: row.kickoffAt,
      status: row.status,
      seasonStart: isInternational
        ? row.kickoffAt
          ? row.kickoffAt.getUTCFullYear()
          : null
        : seasonStart,
      seasonLabel: isInternational
        ? row.kickoffAt
          ? String(row.kickoffAt.getUTCFullYear())
          : null
        : seasonStart != null
          ? rugbySeasonLabelFromStart(seasonStart)
          : null,
      competitionName,
      competitionType: row.competitionType,
      teamId: row.teamId,
      teamName,
      opponentName,
      opponentCountryName,
      result: resultFromScores(
        row.teamId,
        row.homeTeamId,
        row.awayTeamId,
        row.homeScore,
        row.awayScore,
      ),
      positionName: row.positionName,
      jerseyNumber: row.jerseyNumber,
      squadRole: row.squadRole,
      tries: row.tries ?? perf?.tries ?? 0,
      conversions: row.conversions ?? 0,
      penalties: row.penalties ?? 0,
      dropGoals: row.dropGoals ?? 0,
      points: row.points ?? perf?.points ?? 0,
      minutes: perf ? perf.minutesPlayed : null,
      assists: perf ? perf.tryAssists : null,
      cleanBreaks: perf ? perf.lineBreaks : null,
      defendersBeaten: perf ? perf.defendersBeaten : null,
      tacklesMade: perf ? perf.tacklesMade : null,
      passes: extraNumber(extras, "passes"),
      badPasses: extraNumber(extras, "badPasses", "bad_passes"),
      conversionAttempts: null,
      penaltyAttempts: null,
      dropGoalAttempts: null,
      isInternational,
      hasPerf: Boolean(perf),
    });
  }

  // Drop future / not-started fixtures without minutes.
  const filtered = matches.filter((m) => {
    if (m.hasPerf || (m.minutes != null && m.minutes > 0)) return true;
    if (isCompletedMatchStatus(m.status)) return true;
    if (m.kickoffAt && m.kickoffAt.getTime() <= Date.now()) return true;
    return false;
  });

  const stintRows = await db
    .select({
      careerType: playerCareerStints.careerType,
      yearsLabel: playerCareerStints.yearsLabel,
      teamName: playerCareerStints.teamName,
      startYear: playerCareerStints.startYear,
      endYear: playerCareerStints.endYear,
      linkedTeamName: teams.name,
    })
    .from(playerCareerStints)
    .leftJoin(teams, eq(playerCareerStints.teamId, teams.id))
    .where(eq(playerCareerStints.playerId, playerId));

  const resolvedStints = stintRows.map((s) => {
    let teamName = s.teamName;
    if (isUnknownStandingsTeamName(teamName) && s.linkedTeamName && !isUnknownStandingsTeamName(s.linkedTeamName)) {
      teamName = s.linkedTeamName;
    }
    return {
      careerType: s.careerType,
      yearsLabel: s.yearsLabel,
      teamName,
      startYear: s.startYear,
      endYear: s.endYear,
    };
  });

  return buildPublicPlayerCareerV2({
    playerId,
    matches: filtered,
    stints: resolvedStints,
    achievements: opts?.achievements ?? [],
    verifiedCaps: opts?.verifiedCaps ?? player.verifiedInternationalCaps,
    internationalTeamName: opts?.internationalTeamName ?? null,
    dataAsOfIso: opts?.dataAsOfIso ?? null,
  });
}
