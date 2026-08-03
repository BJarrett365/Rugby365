import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionCrestStatus } from "@/lib/crest-library-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const seasonId = searchParams.get("seasonId");
    if (!competitionId || !seasonId) {
      return NextResponse.json(
        { ok: false, error: "competitionId and seasonId are required" },
        { status: 400 },
      );
    }
    const result = await getCompetitionCrestStatus(competitionId, seasonId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load crest status");
  }
}
