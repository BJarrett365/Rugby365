import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getPlayerAvailabilityContext,
  getTeamAvailabilitySummary,
} from "@/lib/player-availability-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get("playerId");
    const teamId = searchParams.get("teamId");

    if (playerId) {
      const context = await getPlayerAvailabilityContext(playerId);
      return NextResponse.json({ player: context });
    }

    if (teamId) {
      const summary = await getTeamAvailabilitySummary(teamId);
      return NextResponse.json({ team: summary });
    }

    return NextResponse.json({ error: "playerId or teamId required" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load availability summary");
  }
}
