import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { getFixtureDatesInRange } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";

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
    const dates = await getFixtureDatesInRange(season, start, end, timeZone, {
      competitionId,
    });
    return NextResponse.json({
      start,
      end,
      timeZone,
      competitionId: competitionId || null,
      dates,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load fixture dates");
  }
}
