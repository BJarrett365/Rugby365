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
  parseRugbyDataScore,
  rugbyDataEventTypeToMatchEvent,
  rugbyDataStatusToFixtureStatus,
  teamNameKey,
  type RugbyDataInfoEvent,
  type RugbyDataListedMatch,
} from "./rugby-data-day-sync";
import { utcInstantFromZonedWallClock } from "@rugby365/import-sdk";
import { addDaysToDateKey } from "./match-schedule-utils";

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
  candidates: Array<{
    id: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeName: string | null;
    awayName: string | null;
    kickoffAt: Date | null;
  }>,
): Promise<{ fixtureId: string; via: "mapping" | "identity" } | null> {
  const externalId = String(match.id);
  const mapped = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId,
  });
  if (mapped?.rugby365Id) {
    return { fixtureId: mapped.rugby365Id, via: "mapping" };
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
  if (!identity) return null;

  const hits = candidates.filter((row) => {
    const key = `${String(row.kickoffAt?.toISOString() ?? "").slice(0, 10)}:${teamNameKey(row.homeName)}:${teamNameKey(row.awayName)}`;
    // kickoff ISO date may differ from wall-clock date; also try name-only on candidate list for that day
    const nameKey = `${teamNameKey(row.homeName)}:${teamNameKey(row.awayName)}`;
    const wantNames = identity.slice(11); // after YYYY-MM-DD:
    return nameKey === wantNames;
  });

  if (hits.length === 1) {
    // Unique home/away pair on that calendar day is enough to confirm P1↔CMS match link.
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "match",
      externalId,
      rugby365Id: hits[0].id,
      rugby365Name: `${hits[0].homeName ?? "?"} v ${hits[0].awayName ?? "?"}`,
      confirmedBy: "rugby_data_day_sync",
      notes: `Day identity match (${match.dt ?? dateFromListed(match)})`,
    }).catch(() => null);
    return { fixtureId: hits[0].id, via: "identity" };
  }

  return null;
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
  // fall through to scheduled — promote when a score is present after kickoff.
  if (status === "scheduled" && score && existing.kickoffAt) {
    const kickoffMs = new Date(existing.kickoffAt).getTime();
    if (Number.isFinite(kickoffMs) && Date.now() - kickoffMs > 90 * 60 * 1000) {
      status = "full_time";
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

  const patch: Partial<{ homeScore: number; awayScore: number; status: string; providerSnapshot: unknown }> =
    {};
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
  options: { timeZone?: string; syncEvents?: boolean } = {},
): Promise<RugbyDataDaySyncResult> {
  const timeZone = options.timeZone ?? "Europe/London";
  const syncEvents = options.syncEvents !== false;
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
  const candidates = fixtureRows.map((f) => ({
    id: f.id,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeName: f.homeTeamId ? teamById[f.homeTeamId] ?? null : null,
    awayName: f.awayTeamId ? teamById[f.awayTeamId] ?? null : null,
    kickoffAt: f.kickoffAt,
  }));

  for (const match of onDay) {
    try {
      const resolved = await resolveFixtureForListedMatch(match, candidates);
      if (!resolved) {
        result.unmatched += 1;
        continue;
      }
      result.matched += 1;

      const scoreResult = await applyScoreAndStatus(resolved.fixtureId, match);
      if (scoreResult.scoreChanged) result.scoresUpdated += 1;
      if (scoreResult.statusChanged) result.statusesUpdated += 1;
      result.skippedLocked += scoreResult.skippedLocked;

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

  return result;
}
