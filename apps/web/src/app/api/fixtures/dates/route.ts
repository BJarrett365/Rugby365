import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { getFixtureDatesInRange } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { cachedPublic, PUBLIC_CACHE_TTL, publicJsonCacheHeaders } from "@/lib/public-data-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const timeZone = searchParams.get("tz") ?? DEFAULT_FIXTURES_TIMEZONE;
    const competitionId = searchParams.get("competitionId");

    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return NextResponse.json({ error: "Invalid start/end (use YYYY-MM-DD)" }, { status: 400 });
    }

    const season = start.slice(0, 4);
    const cacheKey = `fixtures:dates:${season}:${start}:${end}:${timeZone}:${competitionId ?? ""}`;
    const dates = await cachedPublic(cacheKey, PUBLIC_CACHE_TTL.fixturesMeta, () =>
      getFixtureDatesInRange(season, start, end, timeZone, {
        competitionId,
      }),
    );
    return NextResponse.json(
      {
        start,
        end,
        timeZone,
        competitionId: competitionId || null,
        dates,
      },
      {
        headers: publicJsonCacheHeaders(PUBLIC_CACHE_TTL.fixturesMeta, 300),
      },
    );
  } catch (e) {
    return apiErrorResponse(e, "Failed to load fixture dates");
  }
}
