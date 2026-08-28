import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { addDaysToDateKey, dateKeyLocal } from "@/lib/match-schedule-utils";
import { apiErrorResponse } from "@/lib/api-errors";
import { syncRugbyDataFixturesForDate } from "@/lib/rugby-data-day-sync-service";
import { syncStaleScheduledScoresFromSdms } from "@/lib/fixture-live-score-sync";
import { invalidatePublicCache } from "@/lib/public-data-cache";

/**
 * Refresh Rugby Data scores/status for today (and yesterday overnight).
 * Auth: Authorization: Bearer $CRON_SECRET (or x-cron-secret).
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
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const timeZone = DEFAULT_FIXTURES_TIMEZONE;
    const today = dateKeyLocal(new Date());
    const hour = new Date().getUTCHours();
    const dates = hour < 2 ? [today, addDaysToDateKey(today, -1)] : [today];

    const results = [];
    for (const dateKey of dates) {
      const result = await syncRugbyDataFixturesForDate(dateKey, {
        timeZone,
        syncEvents: false,
        mirrorSupabase: false,
      });
      results.push(result);
    }
    const stale = await syncStaleScheduledScoresFromSdms({
      lookbackDays: 14,
      olderThanMinutes: 90,
      limit: 8,
    });
    if (
      results.some((r) => r.scoresUpdated > 0 || r.statusesUpdated > 0) ||
      stale.updated > 0
    ) {
      invalidatePublicCache("fixtures:schedule:");
      invalidatePublicCache("competition-hub");
    }

    return NextResponse.json({ ok: true, results, stale, at: new Date().toISOString() });
  } catch (e) {
    return apiErrorResponse(e, "Live score sync failed");
  }
}

export const POST = GET;
export const maxDuration = 26;
