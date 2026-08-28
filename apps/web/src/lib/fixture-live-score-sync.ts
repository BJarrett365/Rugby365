import { and, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { fetchSdmsMatchDetail, type SdmsMatchDetail } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { listFieldLocks } from "./provider-mapping-service";
import { isFieldLocked } from "./data-integration-overwrite";
import { sdmsStatusToPeriod } from "./rugby-match-clock";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";
import { isFixtureRatingsPublished } from "./match-rating-math";

function sdmsStatusToFixtureStatus(status: string): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half\s*time|halftime|^ht\b/i.test(status)) return "half_time";
  if (/live|first|second|in\s*play/i.test(status)) return "live";
  return "scheduled";
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
  const isLive = isLiveFixtureStatus(sdmsStatusToFixtureStatus(detail.status));
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

  const nextStatus = sdmsStatusToFixtureStatus(detail.status);
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
    if (!externalId) continue;
    const list = byExternal.get(externalId) ?? [];
    list.push(row.id);
    byExternal.set(externalId, list);
    if (byExternal.size >= limit) break;
  }

  let updated = 0;
  const errors: string[] = [];
  for (const [externalId, ids] of byExternal) {
    try {
      const detail = await fetchSdmsMatchDetail(externalId);
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
