import { and, desc, eq, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  providerEntityMappings,
} from "@rugby365/db";
import { getDb } from "./db";
import { mergeProviderSnapshot } from "./head-to-head-shared";
import {
  bumpIntegrationJobCounters,
  completeIntegrationJob,
  createIntegrationJob,
  failIntegrationJob,
  startIntegrationJob,
  updateIntegrationJobProgress,
} from "./data-integration-job-service";
import { mapRugbyDataPlayer, findCompetitionForLeague } from "./rugby-data-mapping-service";
import { PROVIDER_RUGBY_DATA, PROVIDER_SDMS } from "./provider-mapping-types";
import {
  fetchRugbyDataMatchDetail,
  fetchRugbyDataMatchInfo,
  fetchRugbyDataMatchLineup,
  fetchRugbyDataMatchPlayerStats,
  fetchRugbyDataMatchTeamStats,
} from "./rugby-data-api-client";
import {
  buildRugbyDataEventId,
  parseRugbyDataScore,
  rugbyDataEventTypeToMatchEvent,
  rugbyDataStatusToFixtureStatus,
  type RugbyDataInfoEvent,
} from "./rugby-data-day-sync";
import {
  parseRugbyDataKickoffIso,
  parseRugbyDataPlayerStats,
  parseRugbyDataTeamStats,
  rugbyDataImportConcurrency,
  runWithConcurrency,
  throttleRugbyDataImport,
} from "./rugby-data-import-utils";
import { upsertTeamMatchStat } from "./team-match-stats-service";

export type RugbyDataMatchEnrichResult = {
  fixtureId: string;
  externalMatchId: string;
  detailUpdated: boolean;
  eventsImported: number;
  lineupPlayers: number;
  teamStats: number;
  playerStats: number;
  errors: string[];
};

export type RugbyDataEnrichBatchResult = {
  jobId: string;
  processed: number;
  enriched: number;
  errors: string[];
};

type LineupPlayer = {
  playerId: number;
  playerName: string;
  teamId: number;
  jerseyNumber: number | null;
  squadRole: "starting" | "bench";
  positionName: string | null;
};

function parseLineup(data: unknown): { homeTeamId: number | null; awayTeamId: number | null; players: LineupPlayer[] } {
  if (!data || typeof data !== "object") {
    return { homeTeamId: null, awayTeamId: null, players: [] };
  }
  const root = data as {
    home_team?: { id?: number; lineup?: Array<Record<string, unknown>> };
    away_team?: { id?: number; lineup?: Array<Record<string, unknown>> };
  };

  const players: LineupPlayer[] = [];
  for (const [, block] of [
    ["home", root.home_team],
    ["away", root.away_team],
  ] as const) {
    if (!block?.id) continue;
    for (const row of block.lineup ?? []) {
      const player = row.player as { id?: number; nm?: string } | undefined;
      const playerId = Number(row.player_id ?? player?.id);
      const playerName = player?.nm ?? "";
      if (!Number.isFinite(playerId) || !playerName) continue;
      const jersey = Number(row.sno);
      players.push({
        playerId,
        playerName,
        teamId: block.id!,
        jerseyNumber: Number.isFinite(jersey) ? jersey : null,
        squadRole:
          Number(row.isb) === 1 || (Number.isFinite(jersey) && jersey > 15) ? "bench" : "starting",
        positionName: typeof row.pos === "string" && row.pos.trim() ? row.pos.trim() : null,
      });
    }
  }

  return {
    homeTeamId: root.home_team?.id ?? null,
    awayTeamId: root.away_team?.id ?? null,
    players,
  };
}

async function syncEventsFromInfo(
  fixtureId: string,
  matchId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
  eventsBlock: unknown,
): Promise<number> {
  const block = eventsBlock as {
    first_half_events?: RugbyDataInfoEvent[];
    second_half_events?: RugbyDataInfoEvent[];
  } | null;
  const incomingRaw = [...(block?.first_half_events ?? []), ...(block?.second_half_events ?? [])];
  if (!incomingRaw.length) return 0;

  const db = getDb();
  const existing = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
  if (existing.some((row) => row.sourceProvider === PROVIDER_SDMS)) return 0;

  for (const row of existing.filter((r) => r.sourceProvider === PROVIDER_RUGBY_DATA)) {
    await db.delete(matchEvents).where(eq(matchEvents.id, row.id));
  }

  const [last] = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);
  let sequenceNo = last?.sequenceNo ?? 0;

  const values = [];
  for (let i = 0; i < incomingRaw.length; i++) {
    const event = incomingRaw[i]!;
    const eventType = rugbyDataEventTypeToMatchEvent(event.ty);
    if (!eventType) continue;
    const minute = Number(event.mins);
    sequenceNo += 1;
    values.push({
      fixtureId,
      eventType,
      minute: Number.isFinite(minute) ? minute : 0,
      second: 0,
      teamId: event.isH === 1 || event.isH === true ? homeTeamId : awayTeamId,
      payload: {
        rugby_data_event_id: buildRugbyDataEventId(matchId, event, i),
        rugby_data_match_id: matchId,
        player_name: event.pl?.name ?? null,
        player_external_id: event.pl?.id != null ? String(event.pl.id) : null,
        score: event.sc ?? null,
        provider_type: event.ty ?? null,
      },
      sourceProvider: PROVIDER_RUGBY_DATA,
      sequenceNo,
    });
  }

  if (!values.length) return 0;
  await db.insert(matchEvents).values(values);
  return values.length;
}

export async function enrichRugbyDataMatch(
  externalMatchId: string,
  options: { fixtureId?: string } = {},
): Promise<RugbyDataMatchEnrichResult> {
  const result: RugbyDataMatchEnrichResult = {
    fixtureId: options.fixtureId ?? "",
    externalMatchId,
    detailUpdated: false,
    eventsImported: 0,
    lineupPlayers: 0,
    teamStats: 0,
    playerStats: 0,
    errors: [],
  };

  const db = getDb();
  let fixture =
    options.fixtureId != null
      ? (await db.select().from(fixtures).where(eq(fixtures.id, options.fixtureId)).limit(1))[0]
      : (await db.select().from(fixtures).where(eq(fixtures.externalMatchId, externalMatchId)).limit(1))[0];

  if (!fixture) {
    const mapping = await db
      .select()
      .from(providerEntityMappings)
      .where(
        and(
          eq(providerEntityMappings.provider, PROVIDER_RUGBY_DATA),
          eq(providerEntityMappings.entityType, "match"),
          eq(providerEntityMappings.externalId, externalMatchId),
          eq(providerEntityMappings.status, "confirmed"),
        ),
      )
      .limit(1);
    if (mapping[0]?.rugby365Id) {
      fixture = (
        await db.select().from(fixtures).where(eq(fixtures.id, mapping[0].rugby365Id)).limit(1)
      )[0];
    }
  }

  if (!fixture) {
    result.errors.push(`No fixture found for match ${externalMatchId}`);
    return result;
  }
  result.fixtureId = fixture.id;

  try {
    await throttleRugbyDataImport();
    const detailRes = await fetchRugbyDataMatchDetail(externalMatchId);
    if (detailRes.ok && detailRes.data && typeof detailRes.data === "object") {
      const detail = detailRes.data as {
        st?: string;
        cp?: string;
        ft?: string;
        cfs?: string;
        dt?: string;
        mins?: string | number;
      };
      const status = rugbyDataStatusToFixtureStatus(detail.st ?? detail.cp);
      const score = parseRugbyDataScore(detail.ft) ?? parseRugbyDataScore(detail.cfs);
      const kickoffAt = parseRugbyDataKickoffIso(detail.dt);
      await db
        .update(fixtures)
        .set({
          status,
          ...(score ? { homeScore: score.homeScore, awayScore: score.awayScore } : {}),
          ...(kickoffAt ? { kickoffAt: new Date(kickoffAt) } : {}),
          matchMinute: Number(detail.mins) || fixture.matchMinute,
          providerSnapshot: mergeProviderSnapshot(fixture.providerSnapshot, {
            rugby_data: {
              matchId: externalMatchId,
              enrichedAt: new Date().toISOString(),
              ft: detail.ft ?? null,
              st: detail.st ?? detail.cp ?? null,
            },
          }),
        })
        .where(eq(fixtures.id, fixture.id));
      result.detailUpdated = true;
    }

    await throttleRugbyDataImport();
    const infoRes = await fetchRugbyDataMatchInfo(externalMatchId);
    if (infoRes.ok && infoRes.data && typeof infoRes.data === "object") {
      const events = (infoRes.data as { events?: unknown }).events;
      result.eventsImported = await syncEventsFromInfo(
        fixture.id,
        externalMatchId,
        fixture.homeTeamId,
        fixture.awayTeamId,
        events,
      );
    }

    await throttleRugbyDataImport();
    const lineupRes = await fetchRugbyDataMatchLineup(externalMatchId);
    if (lineupRes.ok) {
      const parsed = parseLineup(lineupRes.data);
      const { findTeamForRugbyDataId } = await import("./rugby-data-mapping-service");
      for (const row of parsed.players) {
        const mapped = await mapRugbyDataPlayer({
          externalPlayerId: row.playerId,
          name: row.playerName,
          positionName: row.positionName,
        });
        if (!mapped.playerId) continue;

        const teamId =
          row.teamId === parsed.homeTeamId
            ? fixture.homeTeamId
            : row.teamId === parsed.awayTeamId
              ? fixture.awayTeamId
              : (await findTeamForRugbyDataId(row.teamId)) ?? fixture.homeTeamId;
        if (!teamId) continue;

        const [existing] = await db
          .select()
          .from(fixturePlayers)
          .where(
            and(
              eq(fixturePlayers.fixtureId, fixture.id),
              eq(fixturePlayers.playerId, mapped.playerId),
            ),
          )
          .limit(1);

        const values = {
          fixtureId: fixture.id,
          playerId: mapped.playerId,
          teamId,
          jerseyNumber: row.jerseyNumber,
          squadRole: row.squadRole,
          positionName: row.positionName,
          clubName: null,
        };

        if (existing) {
          await db.update(fixturePlayers).set(values).where(eq(fixturePlayers.id, existing.id));
        } else {
          await db.insert(fixturePlayers).values(values);
        }
        result.lineupPlayers += 1;
      }
    }

    await throttleRugbyDataImport();
    const statRes = await fetchRugbyDataMatchTeamStats(externalMatchId);
    if (statRes.ok && fixture.homeTeamId && fixture.awayTeamId) {
      const parsed = parseRugbyDataTeamStats(statRes.data);
      await upsertTeamMatchStat({
        fixtureId: fixture.id,
        teamId: fixture.homeTeamId,
        side: "home",
        seasonId: fixture.seasonId,
        competitionId: fixture.competitionId,
        externalMatchId,
        stats: parsed.home,
        sourceProvider: PROVIDER_RUGBY_DATA,
      });
      await upsertTeamMatchStat({
        fixtureId: fixture.id,
        teamId: fixture.awayTeamId,
        side: "away",
        seasonId: fixture.seasonId,
        competitionId: fixture.competitionId,
        externalMatchId,
        stats: parsed.away,
        sourceProvider: PROVIDER_RUGBY_DATA,
      });
      result.teamStats = 2;
    }

    await throttleRugbyDataImport();
    const playerStatRes = await fetchRugbyDataMatchPlayerStats(externalMatchId);
    if (playerStatRes.ok && fixture.homeTeamId && fixture.awayTeamId) {
      const rows = parseRugbyDataPlayerStats(playerStatRes.data);
      for (const row of rows) {
        const mapped = await mapRugbyDataPlayer({
          externalPlayerId: row.playerId,
          name: row.playerName,
          teamId: row.isHome ? fixture.homeTeamId : fixture.awayTeamId,
        });
        if (!mapped.playerId) continue;

        const teamId = row.isHome ? fixture.homeTeamId : fixture.awayTeamId;
        const importKey = `rd:${externalMatchId}:${row.playerId}`;
        const values = {
          fixtureId: fixture.id,
          playerId: mapped.playerId,
          teamId,
          seasonId: fixture.seasonId,
          competitionId: fixture.competitionId,
          externalMatchId,
          externalPlayerId: String(row.playerId),
          minutesPlayed: row.stats.Minutes ?? 0,
          tries: row.stats.Tries ?? 0,
          points: row.stats.Goals ?? row.stats.points ?? 0,
          carries: row.stats.Carries ?? 0,
          metresCarried: row.stats.Metres ?? row.stats["Metres carried"] ?? 0,
          tacklesMade: row.stats.Tackles ?? row.stats["Tackles made"] ?? 0,
          tacklesCompleted: row.stats["Tackles completed"] ?? 0,
          dominantTackles: row.stats["Dominant tackles"] ?? 0,
          turnoversWon: row.stats["Turnovers won"] ?? 0,
          tryAssists: row.stats["Try assists"] ?? 0,
          lineBreaks: row.stats["Line breaks"] ?? 0,
          defendersBeaten: row.stats["Defenders beaten"] ?? 0,
          touches: row.stats.Touches ?? 0,
          postContactMetres: row.stats["Post contact metres"] ?? 0,
          ruckArrivalEffectiveness: 0,
          extras: row.stats,
          sourceProvider: PROVIDER_RUGBY_DATA,
          importKey,
          syncedAt: new Date(),
        };

        const [existing] = await db
          .select({ id: playerMatchPerformanceStats.id })
          .from(playerMatchPerformanceStats)
          .where(eq(playerMatchPerformanceStats.importKey, importKey))
          .limit(1);

        if (existing) {
          await db
            .update(playerMatchPerformanceStats)
            .set(values)
            .where(eq(playerMatchPerformanceStats.id, existing.id));
        } else {
          await db.insert(playerMatchPerformanceStats).values(values);
        }
        result.playerStats += 1;
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  if (
    result.detailUpdated ||
    result.eventsImported ||
    result.lineupPlayers ||
    result.teamStats ||
    result.playerStats
  ) {
    try {
      const { cascadeFixtureDataChange } = await import("./data-change-event-service");
      const eventType =
        result.lineupPlayers && !result.teamStats && !result.playerStats
          ? "LINEUP_UPDATED"
          : result.teamStats
            ? "TEAM_STATS_UPDATED"
            : result.playerStats
              ? "PLAYER_STATS_UPDATED"
              : "MATCH_UPDATED";
      await cascadeFixtureDataChange({
        fixtureId: fixture.id,
        eventType,
        source: "rugby_data",
        importMethod: "LIVE_FEED",
        processNow: false,
      });
    } catch {
      // Stale marking is best-effort.
    }
  }

  return result;
}

async function listFixtureIdsForEnrichment(input: {
  leagueId?: number;
  status?: string;
  limit?: number;
}): Promise<Array<{ fixtureId: string; externalMatchId: string }>> {
  const db = getDb();
  const limit = input.limit ?? 500;
  const status = input.status ?? "full_time";

  const conditions = [eq(fixtures.status, status)];

  if (input.leagueId != null) {
    const competitionId = await findCompetitionForLeague(input.leagueId);
    if (competitionId) {
      conditions.push(eq(fixtures.competitionId, competitionId));
    }
  }

  const rows = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      providerSnapshot: fixtures.providerSnapshot,
    })
    .from(fixtures)
    .where(and(...conditions))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(limit);

  return rows
    .map((row) => {
      const snap =
        row.providerSnapshot && typeof row.providerSnapshot === "object"
          ? (row.providerSnapshot as { rugby_data?: { matchId?: string } }).rugby_data
          : null;
      const externalMatchId = row.externalMatchId ?? snap?.matchId ?? null;
      if (!externalMatchId) return null;
      return { fixtureId: row.id, externalMatchId };
    })
    .filter((row): row is { fixtureId: string; externalMatchId: string } => row != null);
}

export async function enrichRugbyDataMatches(input: {
  leagueId?: number;
  status?: string;
  limit?: number;
  jobId?: string;
  startedBy?: string;
} = {}): Promise<RugbyDataEnrichBatchResult> {
  const job =
    input.jobId != null
      ? { id: input.jobId }
      : await createIntegrationJob({
          name: input.leagueId
            ? `Enrich Rugby Data matches (league ${input.leagueId})`
            : "Enrich Rugby Data finished matches",
          jobType: "rugby_data_enrich",
          startedBy: input.startedBy ?? "system",
        });

  await startIntegrationJob(job.id);

  const result: RugbyDataEnrichBatchResult = {
    jobId: job.id,
    processed: 0,
    enriched: 0,
    errors: [],
  };

  try {
    const targets = await listFixtureIdsForEnrichment(input);
    await updateIntegrationJobProgress(job.id, { recordsFound: targets.length });

    const concurrency = rugbyDataImportConcurrency();
    await runWithConcurrency(targets, concurrency, async (target) => {
      const enriched = await enrichRugbyDataMatch(target.externalMatchId, {
        fixtureId: target.fixtureId,
      });
      result.processed += 1;
      if (
        enriched.detailUpdated ||
        enriched.eventsImported ||
        enriched.lineupPlayers ||
        enriched.teamStats ||
        enriched.playerStats
      ) {
        result.enriched += 1;
      }
      if (enriched.errors.length) result.errors.push(...enriched.errors);

      await updateIntegrationJobProgress(job.id, {
        report: { lastMatchId: target.externalMatchId, lastFixtureId: target.fixtureId },
      });
      await bumpIntegrationJobCounters(job.id, {
        recordsUpdated: enriched.detailUpdated ? 1 : 0,
        recordsCreated: enriched.lineupPlayers + enriched.playerStats,
        errors: enriched.errors.length,
      });
    });

    await completeIntegrationJob(job.id, result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    await failIntegrationJob(job.id, message, result as unknown as Record<string, unknown>);
    throw error;
  }

  return result;
}

export async function buildRugbyDataImportCoverageReport() {
  const db = getDb();
  const { countMappingsByStatus } = await import("./provider-mapping-service");
  const mappingCounts = await countMappingsByStatus(PROVIDER_RUGBY_DATA);

  const [row] = await db.execute(sql`
    select
      (select count(*)::int from fixtures where external_match_id is not null) as fixtures_with_external_id,
      (select count(*)::int from fixture_players) as fixture_players,
      (select count(*)::int from team_match_stats where source_provider = 'rugby_data') as rugby_data_team_stats,
      (select count(*)::int from player_match_performance_stats where source_provider = 'rugby_data') as rugby_data_player_stats,
      (select count(*)::int from match_events where source_provider = 'rugby_data') as rugby_data_events,
      (select count(*)::int from provider_entity_mappings where provider = 'rugby_data' and status = 'confirmed') as confirmed_mappings
  `);

  const stats = (Array.isArray(row) ? row[0] : row) as Record<string, number> | undefined;

  return {
    mappingCounts,
    fixturesWithExternalId: stats?.fixtures_with_external_id ?? 0,
    fixturePlayers: stats?.fixture_players ?? 0,
    rugbyDataTeamStats: stats?.rugby_data_team_stats ?? 0,
    rugbyDataPlayerStats: stats?.rugby_data_player_stats ?? 0,
    rugbyDataEvents: stats?.rugby_data_events ?? 0,
    confirmedMappings: stats?.confirmed_mappings ?? 0,
    generatedAt: new Date().toISOString(),
  };
}
