import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getCompetitionShirtStatus,
  listAwaitingReviewShirts,
} from "@/lib/shirt-library-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const seasonId = searchParams.get("seasonId");
    if (!competitionId || !seasonId) {
      return NextResponse.json(
        { error: "competitionId and seasonId are required" },
        { status: 400 },
      );
    }
    const [status, awaiting] = await Promise.all([
      getCompetitionShirtStatus(competitionId, seasonId),
      listAwaitingReviewShirts(competitionId, seasonId),
    ]);
    return NextResponse.json({ ok: true, ...status, awaitingReviewQueue: awaiting });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition shirt status");
  }
}
