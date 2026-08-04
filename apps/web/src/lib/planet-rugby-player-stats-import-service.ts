import {
  emptyParsedPlayerMatchPerformance,
  fetchSdmsMatchDetail,
  fetchSdmsMatchPlayerStats,
  fetchSdmsMatchStats,
  parseMatchPlayerPerformance,
  parseSdmsMatchTeamStats,
} from "@rugby365/import-sdk";
import { and, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  fixturePlayers,
  matchEvents,
  playerMatchPerformanceStats,
  players,
} from "@rugby365/db";
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
import { inferGapFillMinutes, isStarterSquadRole } from "./match-stats-gap-fill";

export type MatchStatsImportResult = {
  matchId: string;
  fixtureId: string;
  teamStatsCreated: number;
  teamStatsUpdated: number;
  playersProcessed: number;
  playerStatsCreated: number;
  playerStatsUpdated: number;
  /** Starters/used subs omitted by SDMS, filled from lineup + substitution minutes. */
  playerStatsGapFilled: number;
  seasonLabel: string | null;
};

/**
 * SDMS sometimes omits starters (and used replacements) from player-stats feeds.
 * Create zero-stat performance rows with minutes inferred from substitution events
 * so match ratings can still be calculated. Unused bench players are left alone (DNP).
 */
export async function gapFillMissingSquadPerformanceStats(input: {
  fixtureId: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  seasonId: string | null;
  competitionId: string | null;
}): Promise<{ gapFilled: number }> {
  const db = getDb();
  const [squadRows, existingPerf, subEvents] = await Promise.all([
    db
      .select({
        playerId: fixturePlayers.playerId,
        teamId: fixturePlayers.teamId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        tries: fixturePlayers.tries,
        points: fixturePlayers.points,
        playerName: players.name,
        externalPlayerId: players.externalProviderId,
      })
      .from(fixturePlayers)
      .innerJoin(players, eq(fixturePlayers.playerId, players.id))
      .where(eq(fixturePlayers.fixtureId, input.fixtureId)),
    db
      .select({ playerId: playerMatchPerformanceStats.playerId })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.fixtureId, input.fixtureId)),
    db
      .select({
        minute: matchEvents.minute,
        playerId: matchEvents.playerId,
        payload: matchEvents.payload,
      })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.fixtureId, input.fixtureId),
          inArray(matchEvents.eventType, ["substitution", "sub_on", "sub_off", "replacement"]),
        ),
      ),
  ]);

  const hasPerf = new Set(existingPerf.map((r) => r.playerId));
  const offMinuteByPlayer = new Map<string, number>();
  const onMinuteByPlayer = new Map<string, number>();

  for (const ev of subEvents) {
    if (ev.playerId == null || ev.minute == null) continue;
    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    const type = String(payload.type ?? "").toLowerCase();
    if (type.includes("off") || type === "sub off") {
      const prev = offMinuteByPlayer.get(ev.playerId);
      if (prev == null || ev.minute < prev) offMinuteByPlayer.set(ev.playerId, ev.minute);
    } else if (type.includes("on") || type === "sub on") {
      const prev = onMinuteByPlayer.get(ev.playerId);
      if (prev == null || ev.minute < prev) onMinuteByPlayer.set(ev.playerId, ev.minute);
    }
  }

  let gapFilled = 0;
  for (const squad of squadRows) {
    if (hasPerf.has(squad.playerId)) continue;
    if (!squad.externalPlayerId) continue;

    const starter = isStarterSquadRole(squad.squadRole, squad.jerseyNumber);
    const minutesPlayed = inferGapFillMinutes({
      starter,
      subOnMinute: onMinuteByPlayer.get(squad.playerId) ?? null,
      subOffMinute: offMinuteByPlayer.get(squad.playerId) ?? null,
    });

    // Unused bench / no evidence of minutes → leave as DNP (no performance row).
    if (minutesPlayed == null || minutesPlayed <= 0) continue;

    const side: "home" | "away" =
      squad.teamId === input.homeTeamId
        ? "home"
        : squad.teamId === input.awayTeamId
          ? "away"
          : "home";

    const stats = emptyParsedPlayerMatchPerformance(
      squad.externalPlayerId,
      squad.playerName,
      side,
    );
    stats.minutesPlayed = minutesPlayed;

    const result = await upsertMatchPerformanceStat({
      fixtureId: input.fixtureId,
      playerId: squad.playerId,
      teamId: squad.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      externalMatchId: input.matchId,
      externalPlayerId: squad.externalPlayerId,
      sourceProvider: "sdms_gap_fill",
      stats: {
        ...stats,
        tries: squad.tries ?? 0,
        points: squad.points ?? 0,
        gapFilled: true,
      },
    });
    if (result.created || result.row) gapFilled += 1;
    hasPerf.add(squad.playerId);
  }

  return { gapFilled };
}

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

  const { gapFilled: playerStatsGapFilled } = await gapFillMissingSquadPerformanceStats({
    fixtureId,
    matchId,
    homeTeamId: fixture.homeTeamId!,
    awayTeamId: fixture.awayTeamId!,
    seasonId,
    competitionId: fixture.competitionId,
  });

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
    playerStatsGapFilled,
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
