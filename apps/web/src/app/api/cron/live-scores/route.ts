import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { addDaysToDateKey, dateKeyLocal } from "@/lib/match-schedule-utils";
import { apiErrorResponse } from "@/lib/api-errors";
import { syncRugbyDataFixturesForDate } from "@/lib/rugby-data-day-sync-service";
import {
  syncRecentLiveFixturesFromSdms,
  syncStaleScheduledScoresFromSdms,
} from "@/lib/fixture-live-score-sync";
import { invalidatePublicCache } from "@/lib/public-data-cache";

/**
 * Keep live scores, match events, and FT rating triggers moving without page traffic.
 *
 * Order (time-budgeted under Netlify maxDuration):
 * 1. SDMS live / kick-off-window fixtures (scores + events) — highest priority
 * 2. Rugby Data day score/status refresh
 * 3. Stale scheduled → finished repair
 *
 * Auth: Authorization: Bearer $CRON_SECRET (or x-cron-secret).
 * Scheduled by netlify/functions/live-scores-cron.mts every 2 minutes.
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return bearer === secret || headerSecret === secret;
}

export async function GET(req: Request) {
  const started = Date.now();
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Leave headroom under maxDuration=26s for response + cold start.
    const hardDeadline = started + 22_000;
    const timeZone = DEFAULT_FIXTURES_TIMEZONE;
    const today = dateKeyLocal(new Date());
    const hour = new Date().getUTCHours();
    const dates = hour < 2 ? [today, addDaysToDateKey(today, -1)] : [today];

    // 1) Live matches first — never skip these when the clock is tight.
    const live = await syncRecentLiveFixturesFromSdms({
      lookbackHours: 6,
      lookaheadMinutes: 45,
      limit: 12,
      syncEvents: true,
      deadlineMs: Math.min(hardDeadline, started + 16_000),
    });

    const results = [];
    if (Date.now() < hardDeadline - 4_000) {
      for (const dateKey of dates) {
        if (Date.now() >= hardDeadline - 3_000) break;
        const result = await syncRugbyDataFixturesForDate(dateKey, {
          timeZone,
          syncEvents: false,
          mirrorSupabase: false,
        });
        results.push(result);
      }
    }

    const stale =
      Date.now() < hardDeadline - 2_000
        ? await syncStaleScheduledScoresFromSdms({
            lookbackDays: 14,
            olderThanMinutes: 90,
            limit: live.liveCandidates > 0 ? 4 : 8,
          })
        : { checked: 0, updated: 0, errors: ["skipped: deadline"] };

    if (
      results.some((r) => r.scoresUpdated > 0 || r.statusesUpdated > 0) ||
      live.updated > 0 ||
      live.eventsImported > 0 ||
      live.ratingsTriggered > 0 ||
      stale.updated > 0
    ) {
      invalidatePublicCache("fixtures:schedule:");
      invalidatePublicCache("competition-hub");
    }

    return NextResponse.json({
      ok: true,
      live,
      results,
      stale,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return apiErrorResponse(e, "Live score sync failed");
  }
}

export const POST = GET;
export const maxDuration = 26;
