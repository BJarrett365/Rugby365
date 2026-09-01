import { NextResponse } from "next/server";
import { listFixtureCalendarYears } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { cachedPublic, PUBLIC_CACHE_TTL, publicJsonCacheHeaders } from "@/lib/public-data-cache";

export const dynamic = "force-dynamic";

/** Calendar years that have at least one CMS fixture — Live Centre year picker. */
export async function GET() {
  try {
    const years = await cachedPublic(
      "fixtures:years",
      PUBLIC_CACHE_TTL.fixturesMeta,
      () => listFixtureCalendarYears(),
    );
    return NextResponse.json(
      { years },
      {
        headers: publicJsonCacheHeaders(PUBLIC_CACHE_TTL.fixturesMeta, 300),
      },
    );
  } catch (e) {
    return apiErrorResponse(e, "Failed to load fixture years");
  }
}
