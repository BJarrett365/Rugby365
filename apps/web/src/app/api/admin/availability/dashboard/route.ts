import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getAvailabilityDashboard } from "@/lib/player-availability-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dashboard = await getAvailabilityDashboard({
      teamId: searchParams.get("teamId") ?? undefined,
      seasonId: searchParams.get("seasonId") ?? undefined,
      competitionId: searchParams.get("competitionId") ?? undefined,
    });
    return NextResponse.json({ dashboard });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load availability dashboard");
  }
}
