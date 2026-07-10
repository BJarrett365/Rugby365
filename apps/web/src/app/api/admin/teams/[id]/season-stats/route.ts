import { NextResponse } from "next/server";
import {
  getTeamSeasonStats,
  type TeamSeasonStatsFilters,
} from "@/lib/player-season-stats-service";
import { apiErrorResponse } from "@/lib/api-errors";

function parseFilters(searchParams: URLSearchParams): TeamSeasonStatsFilters {
  return {
    seasonId: searchParams.get("seasonId") ?? undefined,
    competitionId: searchParams.get("competitionId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sortBy:
      (searchParams.get("sortBy") as TeamSeasonStatsFilters["sortBy"]) ?? undefined,
    sortDir: searchParams.get("sortDir") === "desc" ? "desc" : "asc",
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const result = await getTeamSeasonStats(id, parseFilters(searchParams));
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team season stats");
  }
}
