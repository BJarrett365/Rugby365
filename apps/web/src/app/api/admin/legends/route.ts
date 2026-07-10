import { NextResponse } from "next/server";
import { createLegend, listLegends } from "@/lib/legend-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const legends = await listLegends({
      search: searchParams.get("search") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      legendLevel: searchParams.get("legendLevel") ?? undefined,
      legendStatus: searchParams.get("legendStatus") ?? undefined,
    });
    return NextResponse.json({ legends });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list legends");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const legend = await createLegend({
      playerId: String(body.playerId ?? ""),
      legendLevel: String(body.legendLevel ?? "club_legend"),
      legendStatus: body.legendStatus === "inactive" ? "inactive" : "active",
      teamId: body.teamId ? String(body.teamId) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      countryName: body.countryName ? String(body.countryName) : null,
      internationalTeamId: body.internationalTeamId ? String(body.internationalTeamId) : null,
      era: body.era ? String(body.era) : null,
      reason: body.reason ? String(body.reason) : null,
      careerSummary: body.careerSummary ? String(body.careerSummary) : null,
      keyAchievements: Array.isArray(body.keyAchievements)
        ? body.keyAchievements.map(String)
        : undefined,
      notableStats:
        body.notableStats && typeof body.notableStats === "object"
          ? (body.notableStats as Record<string, unknown>)
          : undefined,
      editorNotes: body.editorNotes ? String(body.editorNotes) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
    });
    return NextResponse.json({ legend }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create legend";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
