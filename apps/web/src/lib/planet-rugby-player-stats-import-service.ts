import {
  fetchSdmsMatchDetail,
  fetchSdmsMatchPlayerStats,
  fetchSdmsMatchStats,
  parseMatchPlayerPerformance,
  parseSdmsMatchTeamStats,
} from "@rugby365/import-sdk";
import { eq } from "drizzle-orm";
import { competitionSeasons, fixturePlayers, players } from "@rugby365/db";
import { getDb } from "./db";
import { resolvePlayer, SDMS_PROVIDER } from "./entity-resolve-service";
import { upsertSeason } from "./competition-admin-service";
import { getFixtureById } from "./fixture-admin-service";
import { resolveFixtureSeasonLabel } from "./fixture-season-utils";
import {
  resolveSeasonIdForFixture,
  upsertMatchPerformanceStat,
} from "./player-season-stats-service";
import { upsertTeamMatchStat } from "./team-match-stats-service";

export type MatchStatsImportResult = {
  matchId: string;
  fixtureId: string;
  teamStatsCreated: number;
  teamStatsUpdated: number;
  playersProcessed: number;
  playerStatsCreated: number;
  playerStatsUpdated: number;
  seasonLabel: string | null;
};

async function ensureSeasonRecord(competitionId: string, kickoffAt: Date) {
  const db = getDb();
  const seasonRows = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));

  const label = resolveFixtureSeasonLabel({ kickoffAt, competitionId, seasons: seasonRows });
  const existing = seasonRows.find((season) => season.label === label);
  if (existing) return existing.id;

  const numericLabel = label.match(/\d{4}/)?.[0] ?? String(kickoffAt.getFullYear());
  const created = await upsertSeason({
    competitionId,
    label: numericLabel,
  });
  return created.id;
}

export async function importMatchPerformanceStats(
  fixtureId: string,
  matchId: string,
): Promise<MatchStatsImportResult> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture must have home and away teams before importing match stats.");
  }
  if (!fixture.competitionId) {
    throw new Error("Fixture must be linked to a competition before importing match stats.");
  }

  const kickoffAt = fixture.kickoffAt ?? new Date();
  const seasonId =
    (await resolveSeasonIdForFixture({
      competitionId: fixture.competitionId,
      kickoffAt,
    })) ?? (await ensureSeasonRecord(fixture.competitionId, kickoffAt));

  const [detail, matchStats, playerStats] = await Promise.all([
    fetchSdmsMatchDetail(matchId),
    fetchSdmsMatchStats(matchId),
    fetchSdmsMatchPlayerStats(matchId),
  ]);
  if (!detail) throw new Error(`SDMS match detail not found: ${matchId}`);

  let teamStatsCreated = 0;
  let teamStatsUpdated = 0;
  if (matchStats) {
    for (const parsed of parseSdmsMatchTeamStats(matchStats)) {
      const teamId = parsed.side === "home" ? fixture.homeTeamId! : fixture.awayTeamId!;
      const result = await upsertTeamMatchStat({
        fixtureId,
        teamId,
        side: parsed.side,
        seasonId,
        competitionId: fixture.competitionId,
        externalMatchId: matchId,
        stats: parsed,
      });
      if (result.created) teamStatsCreated += 1;
      else teamStatsUpdated += 1;
    }
  }

  const db = getDb();
  const squadRows = await db
    .select({
      playerId: fixturePlayers.playerId,
      tries: fixturePlayers.tries,
      points: fixturePlayers.points,
      externalProviderId: players.externalProviderId,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  const scoringByExternalId = new Map(
    squadRows
      .filter((row) => row.externalProviderId)
      .map((row) => [row.externalProviderId!, { tries: row.tries, points: row.points, playerId: row.playerId }]),
  );

  const parsedPlayers = parseMatchPlayerPerformance(playerStats);
  let playerStatsCreated = 0;
  let playerStatsUpdated = 0;

  for (const row of parsedPlayers) {
    const teamId = row.side === "home" ? fixture.homeTeamId! : fixture.awayTeamId!;
    const scoring = scoringByExternalId.get(row.externalPlayerId);
    const player =
      scoring?.playerId != null
        ? { id: scoring.playerId }
        : await resolvePlayer({
            name: row.playerName,
            externalProviderId: row.externalPlayerId,
            createIfMissing: true,
            sourceProvider: SDMS_PROVIDER,
          });
    if (!player) continue;

    const result = await upsertMatchPerformanceStat({
      fixtureId,
      playerId: player.id,
      teamId,
      seasonId,
      competitionId: fixture.competitionId,
      externalMatchId: matchId,
      externalPlayerId: row.externalPlayerId,
      stats: {
        ...row,
        tries: scoring?.tries ?? 0,
        points: scoring?.points ?? 0,
      },
    });

    if (result.created) playerStatsCreated += 1;
    else playerStatsUpdated += 1;
  }

  const seasonLabel = resolveFixtureSeasonLabel({
    kickoffAt,
    competitionId: fixture.competitionId,
    seasons: await db
      .select({
        competitionId: competitionSeasons.competitionId,
        label: competitionSeasons.label,
        year: competitionSeasons.year,
      })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.competitionId, fixture.competitionId)),
  });

  return {
    matchId,
    fixtureId,
    teamStatsCreated,
    teamStatsUpdated,
    playersProcessed: parsedPlayers.length,
    playerStatsCreated,
    playerStatsUpdated,
    seasonLabel,
  };
}

export async function importPlanetRugbyMatchStatsFromUrl(sourceUrl: string) {
  const { isPlanetRugbyMatchUrl, parsePlanetRugbyMatchUrl } = await import("@rugby365/import-sdk");
  const { findFixtureByExternalMatchId } = await import("./fixture-admin-service");
  if (!isPlanetRugbyMatchUrl(sourceUrl)) {
    throw new Error("Not a Planet Rugby match URL.");
  }
  const parts = parsePlanetRugbyMatchUrl(sourceUrl);
  const fixture = await findFixtureByExternalMatchId(parts.match_external_id);
  if (!fixture) {
    throw new Error("Fixture not found for this match URL. Import the competition season first.");
  }
  return importMatchPerformanceStats(fixture.id, parts.match_external_id);
}

/** @deprecated Use importMatchPerformanceStats */
export const importMatchPlayerPerformanceStats = importMatchPerformanceStats;

/** @deprecated Use importPlanetRugbyMatchStatsFromUrl */
export const importPlanetRugbyMatchPlayerStatsFromUrl = importPlanetRugbyMatchStatsFromUrl;
