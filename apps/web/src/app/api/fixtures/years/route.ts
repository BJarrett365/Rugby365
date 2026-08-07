import { NextResponse } from "next/server";
import { listFixtureCalendarYears } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";

/** Calendar years that have at least one CMS fixture — Live Centre year picker. */
export async function GET() {
  try {
    const years = await listFixtureCalendarYears();
    return NextResponse.json({ years });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load fixture years");
  }
}
