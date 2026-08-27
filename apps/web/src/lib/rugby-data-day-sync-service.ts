import { and, desc, eq, gte, lt } from "drizzle-orm";
import { fixtures, matchEvents, teams } from "@rugby365/db";
import { getDb } from "./db";
import { decideFieldWrite } from "./data-integration-overwrite";
import {
  confirmMapping,
  getConfirmedMapping,
  listFieldLocks,
  upsertProviderMapping,
  writeAuditLog,
} from "./provider-mapping-service";
import { PROVIDER_RUGBY_DATA, PROVIDER_SDMS } from "./provider-mapping-types";
import {
  fetchRugbyDataMatchInfo,
  fetchRugbyDataMatchesByDate,
} from "./rugby-data-api-client";
import {
  buildRugbyDataEventId,
  filterRugbyDataMatchesOnDate,
  flattenRugbyDataDayMatches,
  listedMatchIdentityKey,
  listRugbyDataSyncCandidates,
  parseRugbyDataScore,
  pickRugbyDataSyncCandidate,
  pickRugbyDataSyncCandidateByExternalId,
  rugbyDataEventTypeToMatchEvent,
  rugbyDataStatusToFixtureStatus,
  type RugbyDataInfoEvent,
  type RugbyDataListedMatch,
  type RugbyDataSyncCandidate,
} from "./rugby-data-day-sync";
import { utcInstantFromZonedWallClock } from "@rugby365/import-sdk";
import { addDaysToDateKey, formatRoundLabel } from "./match-schedule-utils";
import { invalidatePublicCache } from "./public-data-cache";

export type RugbyDataDaySyncResult = {
  dateKey: string;
  listed: number;
  matched: number;
  unmatched: number;
  scoresUpdated: number;
  statusesUpdated: number;
  eventsImported: number;
  skippedLocked: number;
  supabaseUpserted?: number;
  supabaseStoragePath?: string | null;
  errors: string[];
};

function dayBounds(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(addDaysToDateKey(dateKey, 1), "00:00:00", timeZone);
  return { start, end };
}

function dateFromListed(match: RugbyDataListedMatch): string {
  return String(match.dt ?? "").slice(0, 10);
}

async function resolveFixtureForListedMatch(
  match: RugbyDataListedMatch,
  candidates: RugbyDataSyncCandidate[],
): Promise<{ fixtureId: string; via: "mapping" | "identity" | "external_id"; siblingIds: string[] } | null> {
  const externalId = String(match.id);
  const mapped = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId,
  });
  if (mapped?.rugby365Id) {
    const identity = listedMatchIdentityKey(match);
    const siblings = identity
      ? listRugbyDataSyncCandidates(candidates, identity.slice(11)).map((row) => row.id)
      : [];
    return {
      fixtureId: mapped.rugby365Id,
      via: "mapping",
      siblingIds: [...new Set([mapped.rugby365Id, ...siblings])],
    };
  }

  const existingMap = await upsertProviderMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId,
    externalName: `${match.competitors?.htn ?? "?"} v ${match.competitors?.atn ?? "?"}`,
    status: "unmapped",
    extras: {
      tournamentId: match.tournament_id ?? match.leagueId ?? null,
      league: match.league ?? null,
      dt: match.dt ?? null,
    },
  }).catch(() => null);
  void existingMap;

  const identity = listedMatchIdentityKey(match);
  if (identity) {
    const wantNames = identity.slice(11); // after YYYY-MM-DD:
    const hit = pickRugbyDataSyncCandidate(candidates, wantNames);
    if (hit) {
      await confirmMapping({
        provider: PROVIDER_RUGBY_DATA,
        entityType: "match",
        externalId,
        rugby365Id: hit.id,
        rugby365Name: `${hit.homeName ?? "?"} v ${hit.awayName ?? "?"}`,
        confirmedBy: "rugby_data_day_sync",
        notes: `Day identity match (${match.dt ?? dateFromListed(match)})`,
      }).catch(() => null);
      return {
        fixtureId: hit.id,
        via: "identity",
        siblingIds: listRugbyDataSyncCandidates(candidates, wantNames).map((row) => row.id),
      };
    }
  }

  const byExternal = pickRugbyDataSyncCandidateByExternalId(candidates, externalId);
  if (!byExternal) return null;

  await confirmMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId,
    rugby365Id: byExternal.id,
    rugby365Name: `${byExternal.homeName ?? match.competitors?.htn ?? "?"} v ${byExternal.awayName ?? match.competitors?.atn ?? "?"}`,
    confirmedBy: "rugby_data_day_sync",
    notes: `Day externalMatchId match (${match.dt ?? dateFromListed(match)})`,
  }).catch(() => null);
  return {
    fixtureId: byExternal.id,
    via: "external_id",
    siblingIds: candidates
      .filter((row) => (row.externalMatchId ?? "").trim() === externalId)
      .map((row) => row.id),
  };
}

async function applyScoreAndStatus(
  fixtureId: string,
  match: RugbyDataListedMatch,
): Promise<{ scoreChanged: boolean; statusChanged: boolean; skippedLocked: number }> {
  const db = getDb();
  const [existing] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!existing) return { scoreChanged: false, statusChanged: false, skippedLocked: 0 };

  const lockedFields = await listFieldLocks({ entityType: "match", entityId: fixtureId });

  let status = rugbyDataStatusToFixtureStatus(match.st ?? match.cp);
  // Live feeds often leave `ft` empty and put the running score in `cfs`.
  const score =
    status === "live" || status === "half_time"
      ? parseRugbyDataScore(match.cfs) ?? parseRugbyDataScore(match.ft)
      : parseRugbyDataScore(match.ft) ?? parseRugbyDataScore(match.cfs);

  // P1 sometimes returns scores with status labels like "Result only" that used to
  // fall through to scheduled — promote from kickoff + score when the label is weak.
  if (status === "scheduled" && existing.kickoffAt) {
    const kickoffMs = new Date(existing.kickoffAt).getTime();
    if (Number.isFinite(kickoffMs)) {
      const elapsed = Date.now() - kickoffMs;
      if (elapsed > 100 * 60 * 1000 && score) {
        status = "full_time";
      } else if (elapsed > 2 * 60 * 1000 && elapsed <= 100 * 60 * 1000) {
        status = "live";
      } else if (elapsed > 90 * 60 * 1000 && score) {
        status = "full_time";
      }
    }
  }

  // Never let a weak "scheduled" mapping overwrite a live/finished CMS status.
  if (
    status === "scheduled" &&
    (existing.status === "live" ||
      existing.status === "half_time" ||
      existing.status === "full_time")
  ) {
    status = existing.status;
  }

  const patch: Partial<{
    homeScore: number;
    awayScore: number;
    status: string;
    round: string;
    providerSnapshot: unknown;
  }> = {};
  let skippedLocked = 0;
  let scoreChanged = false;
  let statusChanged = false;

  if (score) {
    for (const field of ["homeScore", "awayScore"] as const) {
      const next = field === "homeScore" ? score.homeScore : score.awayScore;
      const decision = decideFieldWrite({
        field,
        currentValue: existing[field],
        primaryValue: next,
        source: "primary",
        lockedFields,
        primaryOwnsField: true,
      });
      if (decision === "skip_locked") skippedLocked += 1;
      if (decision === "apply_primary" || decision === "fill_empty") {
        patch[field] = next;
        scoreChanged = true;
      }
    }
  }

  {
    const decision = decideFieldWrite({
      field: "status",
      currentValue: existing.status,
      primaryValue: status,
      source: "primary",
      lockedFields,
      primaryOwnsField: true,
    });
    if (decision === "skip_locked") skippedLocked += 1;
    if (decision === "apply_primary" || decision === "fill_empty") {
      patch.status = status;
      statusChanged = true;
    }
  }

  const roundLabel = formatRoundLabel(match.ro);
  if (roundLabel && !existing.round?.trim()) {
    patch.round = roundLabel;
  }

  const prevSnap =
    existing.providerSnapshot && typeof existing.providerSnapshot === "object"
      ? (existing.providerSnapshot as Record<string, unknown>)
      : {};
  patch.providerSnapshot = {
    ...prevSnap,
    rugby_data: {
      matchId: String(match.id),
      tournamentId: match.tournament_id ?? match.leagueId ?? null,
      league: match.league ?? null,
      polledAt: new Date().toISOString(),
      ft: match.ft ?? null,
      st: match.st ?? match.cp ?? null,
      mins: match.mins ?? null,
      ro: match.ro ?? null,
      homeName: match.competitors?.htn ?? null,
      awayName: match.competitors?.atn ?? null,
    },
  };

  if (Object.keys(patch).length > 0) {
    await db.update(fixtures).set(patch).where(eq(fixtures.id, fixtureId));
    if (scoreChanged || statusChanged) {
      await writeAuditLog({
        entityType: "match",
        entityId: fixtureId,
        action: "rugby_data_day_sync",
        source: PROVIDER_RUGBY_DATA,
        userLabel: "system",
        newValue: {
          matchId: String(match.id),
          score,
          status,
          scoreChanged,
          statusChanged,
        },
      }).catch(() => null);
    }
  }

  return { scoreChanged, statusChanged, skippedLocked };
}

async function syncEventsFromInfo(
  fixtureId: string,
  matchId: string | number,
  homeTeamId: string | null,
  awayTeamId: string | null,
): Promise<number> {
  const info = await fetchRugbyDataMatchInfo(matchId);
  if (!info.ok || !info.data || typeof info.data !== "object") return 0;

  const eventsBlock = (info.data as { events?: { first_half_events?: RugbyDataInfoEvent[]; second_half_events?: RugbyDataInfoEvent[] } })
    .events;
  const incomingRaw = [
    ...(eventsBlock?.first_half_events ?? []),
    ...(eventsBlock?.second_half_events ?? []),
  ];
  if (incomingRaw.length === 0) return 0;

  const db = getDb();
  const existing = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
  const hasSdms = existing.some((row) => row.sourceProvider === PROVIDER_SDMS);
  // Keep SDMS timeline when present; only refresh P1-owned / empty timelines.
  if (hasSdms) return 0;

  const p1Rows = existing.filter((row) => row.sourceProvider === PROVIDER_RUGBY_DATA);
  for (const row of p1Rows) {
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
    const event = incomingRaw[i];
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
        rugby_data_match_id: String(matchId),
        player_name: event.pl?.name ?? null,
        player_external_id: event.pl?.id != null ? String(event.pl.id) : null,
        score: event.sc ?? null,
        provider_type: event.ty ?? null,
      },
      sourceProvider: PROVIDER_RUGBY_DATA,
      sequenceNo,
    });
  }

  if (values.length === 0) return 0;
  await db.insert(matchEvents).values(values);
  return values.length;
}

/**
 * Pull P1 daily match list and update CMS scores/status (+ events when no SDMS timeline).
 * Safe to call from the public schedule path (best-effort; errors collected).
 */
export async function syncRugbyDataFixturesForDate(
  dateKey: string,
  options: { timeZone?: string; syncEvents?: boolean; mirrorSupabase?: boolean } = {},
): Promise<RugbyDataDaySyncResult> {
  const timeZone = options.timeZone ?? "Europe/London";
  const syncEvents = options.syncEvents !== false;
  const mirrorSupabase = options.mirrorSupabase !== false;
  const result: RugbyDataDaySyncResult = {
    dateKey,
    listed: 0,
    matched: 0,
    unmatched: 0,
    scoresUpdated: 0,
    statusesUpdated: 0,
    eventsImported: 0,
    skippedLocked: 0,
    errors: [],
  };

  const listedRes = await fetchRugbyDataMatchesByDate(dateKey);
  if (!listedRes.ok) {
    result.errors.push(listedRes.errorMessage ?? `Failed to list matches for ${dateKey}`);
    return result;
  }

  const onDay = filterRugbyDataMatchesOnDate(flattenRugbyDataDayMatches(listedRes.data), dateKey);
  result.listed = onDay.length;

  const db = getDb();
  const { start, end } = dayBounds(dateKey, timeZone);
  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)));
  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));
  const candidates: Array<RugbyDataSyncCandidate & { homeTeamId: string | null; awayTeamId: string | null }> =
    fixtureRows.map((f) => ({
      id: f.id,
      slug: f.slug,
      externalMatchId: f.externalMatchId,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeName: f.homeTeamId ? teamById[f.homeTeamId] ?? null : null,
      awayName: f.awayTeamId ? teamById[f.awayTeamId] ?? null : null,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
    }));

  for (const match of onDay) {
    try {
      const resolved = await resolveFixtureForListedMatch(match, candidates);
      if (!resolved) {
        result.unmatched += 1;
        continue;
      }
      result.matched += 1;

      const targetIds = [...new Set([resolved.fixtureId, ...resolved.siblingIds])];
      for (const fixtureId of targetIds) {
        const scoreResult = await applyScoreAndStatus(fixtureId, match);
        if (scoreResult.scoreChanged) result.scoresUpdated += 1;
        if (scoreResult.statusChanged) result.statusesUpdated += 1;
        result.skippedLocked += scoreResult.skippedLocked;
      }

      if (syncEvents) {
        const fixture = candidates.find((c) => c.id === resolved.fixtureId);
        const imported = await syncEventsFromInfo(
          resolved.fixtureId,
          match.id,
          fixture?.homeTeamId ?? null,
          fixture?.awayTeamId ?? null,
        );
        result.eventsImported += imported;
      }
    } catch (error) {
      result.errors.push(
        `${match.competitors?.htn ?? "?"} v ${match.competitors?.atn ?? "?"} (${match.id}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (mirrorSupabase) {
    try {
      const { mirrorLiveFixturesToSupabase } = await import("./supabase-live-service");
      const mirrored = await mirrorLiveFixturesToSupabase(dateKey, { timeZone });
      result.supabaseUpserted = mirrored.upserted;
      result.supabaseStoragePath = mirrored.storagePath;
      result.errors.push(...mirrored.errors.map((e) => `supabase: ${e}`));
    } catch (error) {
      result.errors.push(
        `supabase: ${error instanceof Error ? error.message : "mirror failed"}`,
      );
    }
  }

  return result;
}

const liteSyncInflight = new Map<string, Promise<void>>();

/**
 * Non-blocking P1 score/status refresh for the public lite board.
 * Single-flight per date so /matches traffic cannot stampede the API.
 */
export function scheduleLiteRugbyDataSync(
  dateKey: string,
  timeZone = "Europe/London",
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
  if (liteSyncInflight.has(dateKey)) return;
  const run = syncRugbyDataFixturesForDate(dateKey, {
    timeZone,
    syncEvents: false,
    mirrorSupabase: false,
  })
    .then((result) => {
      if (result.scoresUpdated > 0 || result.statusesUpdated > 0) {
        invalidatePublicCache("fixtures:schedule:");
      }
    })
    .catch((error) => {
      console.warn(
        `[schedule] lite rugby_data sync failed for ${dateKey}:`,
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      liteSyncInflight.delete(dateKey);
    });
  liteSyncInflight.set(dateKey, run);
}
