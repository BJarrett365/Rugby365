import { NextResponse } from "next/server";
import { getPlayerSeasonStats } from "@/lib/player-season-stats-service";
import { importPlanetRugbyMatchPlayerStatsFromUrl } from "@/lib/planet-rugby-player-stats-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seasonStats = await getPlayerSeasonStats(id);
    return NextResponse.json({ seasonStats });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player season stats");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _playerId } = await params;
    const body = (await req.json()) as { url?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const result = await importPlanetRugbyMatchPlayerStatsFromUrl(body.url.trim());
    const seasonStats = await getPlayerSeasonStats(_playerId);
    return NextResponse.json({ result, seasonStats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import player season stats";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
