import { eq } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import type { SdmsMatchDetail } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { listFieldLocks } from "./provider-mapping-service";
import { isFieldLocked } from "./data-integration-overwrite";
import { sdmsStatusToPeriod } from "./rugby-match-clock";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";

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
  return { updated: true, patch };
}
