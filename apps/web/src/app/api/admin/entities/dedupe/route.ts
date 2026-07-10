import { NextResponse } from "next/server";
import { dedupeAllEntities, dedupePlayers, dedupeTeams } from "@/lib/entity-dedup-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { scope?: string };
    const scope = body.scope ?? "all";

    if (scope === "players") {
      return NextResponse.json({ players: await dedupePlayers() });
    }
    if (scope === "teams") {
      return NextResponse.json({ teams: await dedupeTeams() });
    }

    return NextResponse.json(await dedupeAllEntities());
  } catch (e) {
    return apiErrorResponse(e, "Failed to dedupe entities");
  }
}
