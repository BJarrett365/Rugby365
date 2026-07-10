import { NextResponse } from "next/server";
import { getPlayerMatchStatsHistory } from "@/lib/player-season-stats-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const result = await getPlayerMatchStatsHistory(id, {
      seasonId: searchParams.get("seasonId") ?? undefined,
      competitionId: searchParams.get("competitionId") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player match stats");
  }
}
