import { NextResponse } from "next/server";
import { getTeamMatchStatsHistory } from "@/lib/team-match-stats-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const result = await getTeamMatchStatsHistory(id, {
      seasonId: searchParams.get("seasonId") ?? undefined,
      competitionId: searchParams.get("competitionId") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team match stats");
  }
}
