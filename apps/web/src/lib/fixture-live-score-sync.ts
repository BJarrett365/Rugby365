import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { fetchSdmsMatchDetail, type SdmsMatchDetail } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { listFieldLocks } from "./provider-mapping-service";
import { isFieldLocked } from "./data-integration-overwrite";
import { sdmsStatusToPeriod } from "./rugby-match-clock";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";
import { isFixtureRatingsPublished } from "./match-rating-math";

const CMS_LIVE_STATUSES = ["live", "half_time", "first_half", "second_half", "in_progress"] as const;

/**
 * Map SDMS match status → CMS fixture status.
 * Planet Rugby often flips finished feeds to "Deleted" while keeping the final
 * score — treat those as full time so ratings/rankings can publish.
 */
export function sdmsStatusToFixtureStatus(
  status: string,
  scores?: { home?: number | null; away?: number | null },
): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half\s*time|halftime|^ht\b/i.test(status)) return "half_time";
  if (/live|first|second|in\s*play/i.test(status)) return "live";
  if (/^(ft|full[_\s-]?time|complete|finished|result)\b/i.test(status)) return "full_time";
  if (/cancel/i.test(status)) return "cancelled";
  if (/postpon/i.test(status)) return "postponed";
  if (/deleted|abandon/i.test(status)) {
    const hasScore = (scores?.home ?? 0) > 0 || (scores?.away ?? 0) > 0;
    return hasScore ? "full_time" : "cancelled";
  }
  return "scheduled";
}

/** SDMS match ids look like `d9rx3q29` — skip wikipedia:/numeric provider ids. */
export function isSdmsExternalMatchId(id: string | null | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.includes(":") || trimmed.includes("/")) return false;
  if (/^\d+$/.test(trimmed) || /^\d+-\d+$/.test(trimmed)) return false;
  return /^[a-z0-9]{6,16}$/i.test(trimmed);
}

export type LiveScoreSyncPatch = {
  homeScore?: number;
  awayScore?: number;
  status?: string;
  matchMinute?: number;
  matchSecond?: number;
  period?: string;
};

/**
 * Resolve CMS score/clock fields from an SDMS match detail.
 * Never wipe a known CMS score with a blank/0–0 SDMS payload.
 */
export function resolveLiveScoreSyncPatch(
  detail: SdmsMatchDetail,
  existing: {
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    matchMinute: number;
    matchSecond: number;
    period: string;
  },
  lockedFields: Set<string> = new Set(),
): LiveScoreSyncPatch {
  const patch: LiveScoreSyncPatch = {};
  const sdmsHome = detail.home_team_score;
  const sdmsAway = detail.away_team_score;
  const sdmsScoresDefined =
    typeof sdmsHome === "number" && typeof sdmsAway === "number";
  const sdmsHasPositiveScore =
    sdmsScoresDefined && (sdmsHome > 0 || sdmsAway > 0);
  const existingHasScore = (existing.homeScore ?? 0) > 0 || (existing.awayScore ?? 0) > 0;
  const nextStatus = sdmsStatusToFixtureStatus(detail.status, {
    home: sdmsHome,
    away: sdmsAway,
  });
  const isLive = isLiveFixtureStatus(nextStatus);
  // Positive SDMS scores always win (unlocked). Live 0–0 only applies when CMS
  // also has no score yet — never wipe a known CMS score with a blank feed.
  const applyScores =
    sdmsHasPositiveScore || (isLive && sdmsScoresDefined && !existingHasScore);

  if (applyScores && sdmsScoresDefined) {
    if (sdmsHome !== (existing.homeScore ?? 0) && !isFieldLocked("homeScore", lockedFields)) {
      patch.homeScore = sdmsHome;
    }
    if (sdmsAway !== (existing.awayScore ?? 0) && !isFieldLocked("awayScore", lockedFields)) {
      patch.awayScore = sdmsAway;
    }
  }

  if (nextStatus !== existing.status && !isFieldLocked("status", lockedFields)) {
    patch.status = nextStatus;
  }

  const nextPeriod = sdmsStatusToPeriod(detail.status);
  if (nextPeriod !== existing.period && !isFieldLocked("period", lockedFields)) {
    patch.period = nextPeriod;
  }

  if (typeof detail.minutes === "number" && Number.isFinite(detail.minutes)) {
    let minute = Math.max(0, Math.floor(detail.minutes));
    if (nextPeriod === "half_time" && minute === 0) minute = 40;
    // Never let a blank live feed zero wipe a later clock (animation stuck at HT).
    const regressesClock =
      minute === 0 &&
      existing.matchMinute > 0 &&
      nextPeriod !== "half_time" &&
      nextPeriod !== "not_started";
    if (
      !regressesClock &&
      minute !== existing.matchMinute &&
      !isFieldLocked("matchMinute", lockedFields)
    ) {
      patch.matchMinute = minute;
    }
  }

  if (typeof detail.seconds === "number" && Number.isFinite(detail.seconds)) {
    const second = Math.max(0, Math.min(59, Math.floor(detail.seconds)));
    if (
      second !== existing.matchSecond &&
      !isFieldLocked("matchSecond", lockedFields) &&
      (second > 0 || (typeof detail.minutes === "number" && detail.minutes > 0))
    ) {
      patch.matchSecond = second;
    }
  }

  return patch;
}

/**
 * Lightweight sync: push SDMS live score/clock into CMS so Live Table / schedule
 * stay aligned with the Match Centre scoreline. Skips heavy squad/event import.
 * When a fixture flips to full time, schedule match-rating generation so lineups
 * do not stay blank until a later page visit.
 */
export async function syncFixtureLiveStateFromSdms(
  fixtureId: string,
  detail: SdmsMatchDetail,
): Promise<{ updated: boolean; patch: LiveScoreSyncPatch }> {
  const db = getDb();
  const [existing] = await db
    .select({
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
      matchMinute: fixtures.matchMinute,
      matchSecond: fixtures.matchSecond,
      period: fixtures.period,
      externalMatchId: fixtures.externalMatchId,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  if (!existing) return { updated: false, patch: {} };

  const locked = await listFieldLocks({ entityType: "match", entityId: fixtureId });
  const patch = resolveLiveScoreSyncPatch(detail, existing, locked);
  if (Object.keys(patch).length === 0) {
    return { updated: false, patch };
  }

  await db.update(fixtures).set(patch).where(eq(fixtures.id, fixtureId));

  const becamePublished =
    patch.status != null &&
    isFixtureRatingsPublished(patch.status) &&
    !isFixtureRatingsPublished(existing.status);
  if (becamePublished) {
    const matchId = existing.externalMatchId ?? detail.match_id ?? null;
    void import("./match-rating-service")
      .then(({ ensureMissingFixturePlayerMatchRatings }) =>
        ensureMissingFixturePlayerMatchRatings(fixtureId, {
          matchId,
          allowSdmsEnrich: true,
        }),
      )
      .catch(() => undefined);
  }

  return { updated: true, patch };
}

/**
 * Copy finished SDMS scorelines onto CMS rows that are still "scheduled"
 * after kickoff. Live cron only covers today; without this, a missed
 * match-day sync (e.g. Currie Cup Bulls vs Stormers XXIII) stays 0–0 and
 * is hidden from competition results.
 */
export async function syncStaleScheduledScoresFromSdms(options?: {
  lookbackDays?: number;
  olderThanMinutes?: number;
  limit?: number;
}): Promise<{ checked: number; updated: number; errors: string[] }> {
  const lookbackDays = options?.lookbackDays ?? 14;
  const olderThanMinutes = options?.olderThanMinutes ?? 90;
  const limit = options?.limit ?? 8;
  const now = Date.now();
  const cutoff = new Date(now - olderThanMinutes * 60_000);
  const lookbackStart = new Date(now - lookbackDays * 24 * 60 * 60_000);
  const db = getDb();

  const rows = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.status, "scheduled"),
        isNotNull(fixtures.externalMatchId),
        isNotNull(fixtures.kickoffAt),
        lt(fixtures.kickoffAt, cutoff),
        gte(fixtures.kickoffAt, lookbackStart),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(Math.max(limit * 3, 12));

  const byExternal = new Map<string, string[]>();
  for (const row of rows) {
    const externalId = row.externalMatchId?.trim();
    if (!isSdmsExternalMatchId(externalId)) continue;
    const list = byExternal.get(externalId!) ?? [];
    list.push(row.id);
    byExternal.set(externalId!, list);
    if (byExternal.size >= limit) break;
  }

  let updated = 0;
  const errors: string[] = [];
  for (const [externalId, ids] of byExternal) {
    try {
      const detail = await fetchSdmsMatchDetail(externalId, { timeoutMs: 8_000 });
      if (!detail) continue;
      const siblings = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(eq(fixtures.externalMatchId, externalId));
      const targetIds = [...new Set([...ids, ...siblings.map((row) => row.id)])];
      for (const fixtureId of targetIds) {
        const result = await syncFixtureLiveStateFromSdms(fixtureId, detail);
        if (result.updated) updated += 1;
      }
    } catch (error) {
      errors.push(
        `${externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { checked: byExternal.size, updated, errors };
}

export type LiveSdmsSyncResult = {
  checked: number;
  updated: number;
  eventsImported: number;
  ratingsTriggered: number;
  errors: string[];
  timedOut: boolean;
  liveCandidates: number;
};

/**
 * Poll SDMS for fixtures that are live / about to kick off / recently finished.
 * Prioritises CMS rows already marked live, imports key events once per match id
 * (not once per duplicate sibling), and respects a deadline so Netlify cron
 * cannot hang past maxDuration.
 */
export async function syncRecentLiveFixturesFromSdms(options?: {
  lookbackHours?: number;
  lookaheadMinutes?: number;
  limit?: number;
  syncEvents?: boolean;
  /** Stop starting new SDMS fetches after this timestamp (ms). */
  deadlineMs?: number;
}): Promise<LiveSdmsSyncResult> {
  const lookbackHours = options?.lookbackHours ?? 6;
  const lookaheadMinutes = options?.lookaheadMinutes ?? 45;
  const limit = options?.limit ?? 12;
  const syncEvents = options?.syncEvents !== false;
  const deadlineMs = options?.deadlineMs ?? Date.now() + 18_000;
  const now = Date.now();
  const windowStart = new Date(now - lookbackHours * 60 * 60_000);
  const windowEnd = new Date(now + lookaheadMinutes * 60_000);
  const db = getDb();

  const [liveRows, windowRows] = await Promise.all([
    db
      .select({
        id: fixtures.id,
        externalMatchId: fixtures.externalMatchId,
        status: fixtures.status,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(fixtures)
      .where(
        and(
          isNotNull(fixtures.externalMatchId),
          inArray(fixtures.status, [...CMS_LIVE_STATUSES]),
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(limit * 2),
    db
      .select({
        id: fixtures.id,
        externalMatchId: fixtures.externalMatchId,
        status: fixtures.status,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(fixtures)
      .where(
        and(
          isNotNull(fixtures.externalMatchId),
          isNotNull(fixtures.kickoffAt),
          gte(fixtures.kickoffAt, windowStart),
          lt(fixtures.kickoffAt, windowEnd),
          // Skip already-finished shells so we spend budget on in-play / pending.
          sql`lower(${fixtures.status}) not in ('full_time','finished','completed','ft','result','cancelled','postponed')`,
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(Math.max(limit * 4, 24)),
  ]);

  type Candidate = {
    id: string;
    externalMatchId: string | null;
    status: string;
    kickoffAt: Date | null;
    priority: number;
  };
  const merged = new Map<string, Candidate>();
  for (const row of liveRows) {
    merged.set(row.id, { ...row, priority: 0 });
  }
  for (const row of windowRows) {
    if (merged.has(row.id)) continue;
    const liveish = isLiveFixtureStatus(row.status) ? 1 : 2;
    merged.set(row.id, { ...row, priority: liveish });
  }

  const ordered = [...merged.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ta = a.kickoffAt?.getTime() ?? 0;
    const tb = b.kickoffAt?.getTime() ?? 0;
    return tb - ta;
  });

  const byExternal = new Map<string, string[]>();
  for (const row of ordered) {
    const externalId = row.externalMatchId?.trim();
    if (!isSdmsExternalMatchId(externalId)) continue;
    const list = byExternal.get(externalId!) ?? [];
    list.push(row.id);
    byExternal.set(externalId!, list);
    if (byExternal.size >= limit) break;
  }

  let updated = 0;
  let eventsImported = 0;
  let ratingsTriggered = 0;
  let timedOut = false;
  const errors: string[] = [];

  for (const [externalId, ids] of byExternal) {
    if (Date.now() >= deadlineMs) {
      timedOut = true;
      break;
    }
    try {
      const detail = await fetchSdmsMatchDetail(externalId, { timeoutMs: 8_000 });
      if (!detail) continue;
      const siblings = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(eq(fixtures.externalMatchId, externalId));
      const targetIds = [...new Set([...ids, ...siblings.map((row) => row.id)])];

      // Cap event imports per match — duplicate CMS rows for the same SDMS id
      // previously stampeded the DB and killed the cron mid-run.
      if (syncEvents && Date.now() < deadlineMs) {
        try {
          const { syncSdmsLiveEventsFromDetail } = await import(
            "./planet-rugby-match-import-service"
          );
          for (const fixtureId of targetIds.slice(0, 2)) {
            if (Date.now() >= deadlineMs) {
              timedOut = true;
              break;
            }
            eventsImported += await syncSdmsLiveEventsFromDetail(
              fixtureId,
              externalId,
              detail,
            );
          }
        } catch (error) {
          errors.push(
            `${externalId} events: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      for (const fixtureId of targetIds) {
        const before = await db
          .select({ status: fixtures.status })
          .from(fixtures)
          .where(eq(fixtures.id, fixtureId))
          .limit(1);
        const result = await syncFixtureLiveStateFromSdms(fixtureId, detail);
        if (result.updated) updated += 1;
        if (
          result.patch.status &&
          isFixtureRatingsPublished(result.patch.status) &&
          before[0] &&
          !isFixtureRatingsPublished(before[0].status)
        ) {
          ratingsTriggered += 1;
        }
      }
    } catch (error) {
      errors.push(
        `${externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    checked: byExternal.size,
    updated,
    eventsImported,
    ratingsTriggered,
    errors,
    timedOut,
    liveCandidates: liveRows.length,
  };
}

const liteSdmsInflight = new Map<string, Promise<void>>();

/**
 * Non-blocking SDMS score/event refresh kicked from the public /matches lite board
 * whenever today's card looks live or inside the kick-off window.
 */
export function scheduleLiteSdmsLiveSync(reason = "schedule"): void {
  if (liteSdmsInflight.has(reason)) return;
  const run = syncRecentLiveFixturesFromSdms({
    lookbackHours: 5,
    lookaheadMinutes: 45,
    limit: 8,
    syncEvents: true,
    deadlineMs: Date.now() + 16_000,
  })
    .then(async (result) => {
      if (result.updated > 0 || result.eventsImported > 0) {
        const { invalidatePublicCache } = await import("./public-data-cache");
        invalidatePublicCache("fixtures:schedule:");
        invalidatePublicCache("competition-hub");
      }
    })
    .catch((error) => {
      console.warn(
        "[schedule] lite SDMS live sync failed:",
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      liteSdmsInflight.delete(reason);
    });
  liteSdmsInflight.set(reason, run);
}
