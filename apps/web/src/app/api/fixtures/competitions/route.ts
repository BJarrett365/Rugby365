import { NextResponse } from "next/server";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { listCompetitionsWithFixturesInYear } from "@/lib/planet-rugby-live-fixtures-service";
import { apiErrorResponse } from "@/lib/api-errors";

/**
 * Competitions that have fixtures in a calendar year (Live Centre filter).
 * Query: ?year=2026&tz=Europe/London
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yearRaw = searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
    const timeZone = searchParams.get("tz") ?? DEFAULT_FIXTURES_TIMEZONE;

    if (!Number.isFinite(year) || year < 1860 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const competitions = await listCompetitionsWithFixturesInYear(year, timeZone);
    return NextResponse.json({ year, timeZone, competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competitions with fixtures");
  }
}
