import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { dateKeyLocal } from "@/lib/match-schedule-utils";
import { getScheduleForDate } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateKey = searchParams.get("date") ?? dateKeyLocal(new Date());
    const timeZone = searchParams.get("tz") ?? DEFAULT_FIXTURES_TIMEZONE;
    const competitionId = searchParams.get("competitionId");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD)" }, { status: 400 });
    }

    const result = await getScheduleForDate(dateKey, timeZone, {
      competitionId,
    });
    return NextResponse.json({ date: dateKey, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load schedule");
  }
}
