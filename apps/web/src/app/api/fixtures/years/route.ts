import { NextResponse } from "next/server";
import { listFixtureCalendarYears } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { cachedPublic, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

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
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    return apiErrorResponse(e, "Failed to load fixture years");
  }
}
