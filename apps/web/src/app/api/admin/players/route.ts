import { NextResponse } from "next/server";
import { createPlayer, listPlayers, listPlayersForPicker, mapEntitiesFromMatches } from "@/lib/entity-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("picker") === "1") {
      const competitionId = searchParams.get("competitionId") ?? undefined;
      const seasonId = searchParams.get("seasonId") ?? undefined;
      const teamId = searchParams.get("teamId") ?? undefined;
      const players = await listPlayersForPicker(
        competitionId && seasonId && teamId ? { competitionId, seasonId, teamId } : undefined,
      );
      return NextResponse.json({ players });
    }
    const result = await listPlayers({
      search: searchParams.get("search") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      seasonId: searchParams.get("seasonId") ?? undefined,
      competitionId: searchParams.get("competitionId") ?? undefined,
      letter: searchParams.get("letter") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 50),
      sortBy: (searchParams.get("sortBy") as "rank" | "name" | null) ?? "rank",
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list players");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action === "map-from-matches") {
      const result = await mapEntitiesFromMatches();
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "calculate-ratings") {
      const { batchCalculateAllPlayerRatings } = await import("@/lib/player-ratings-batch-service");
      const summary = await batchCalculateAllPlayerRatings({
        onlyMissing: body.onlyMissing !== false,
        onlyWithMatchData: true,
        limit: typeof body.limit === "number" ? body.limit : undefined,
      });
      return NextResponse.json({ ok: true, ...summary });
    }
    if (body.action === "fill-profile-gaps") {
      const { fillPlayerProfileGaps } = await import("@/lib/fill-player-profile-gaps-service");
      const summary = await fillPlayerProfileGaps({
        mapFromMatches: body.mapFromMatches !== false,
        repairFromSquads: body.repairFromSquads !== false,
        fillPositionsFromSquads: body.fillPositionsFromSquads !== false,
        backfillFromEvents: body.backfillFromEvents !== false,
        fillNationalityFromBirthPlace: body.fillNationalityFromBirthPlace !== false,
        wikipedia: false,
        calculateRatings: body.calculateRatings !== false,
      });
      return NextResponse.json({ ok: true, ...summary });
    }

    const result = await createPlayer({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      positionName: body.positionName ? String(body.positionName) : undefined,
      clubName: body.clubName ? String(body.clubName) : undefined,
      countryName: body.countryName ? String(body.countryName) : undefined,
      externalProviderId: body.externalProviderId ? String(body.externalProviderId) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create player";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
