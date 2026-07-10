import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/fixture-admin-service";
import { getFixturePlayerMatchStats } from "@/lib/player-season-stats-service";
import { getFixtureTeamMatchStats } from "@/lib/team-match-stats-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fixture = await getFixtureById(id);
    if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [teamStats, playerStats] = await Promise.all([
      getFixtureTeamMatchStats(id),
      getFixturePlayerMatchStats(id),
    ]);

    return NextResponse.json({
      fixture: {
        id: fixture.id,
        slug: fixture.slug,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        externalMatchId: fixture.externalMatchId,
      },
      teamStats,
      playerStats,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match stats");
  }
}
