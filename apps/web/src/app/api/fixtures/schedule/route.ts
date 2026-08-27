import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { dateKeyLocal } from "@/lib/match-schedule-utils";
import { getScheduleForDate } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { cachedPublic, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateKey = searchParams.get("date") ?? dateKeyLocal(new Date());
    const timeZone = searchParams.get("tz") ?? DEFAULT_FIXTURES_TIMEZONE;
    const competitionId = searchParams.get("competitionId");
    const lite = searchParams.get("lite") === "1";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD)" }, { status: 400 });
    }

    const cacheKey = `fixtures:schedule:${dateKey}:${timeZone}:${competitionId ?? ""}:${lite ? "1" : "0"}`;
    const result = await cachedPublic(cacheKey, PUBLIC_CACHE_TTL.fixturesSchedule, () =>
      getScheduleForDate(dateKey, timeZone, {
        competitionId,
        lite,
      }),
    );
    return NextResponse.json(
      { date: dateKey, ...result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    return apiErrorResponse(e, "Failed to load schedule");
  }
}
