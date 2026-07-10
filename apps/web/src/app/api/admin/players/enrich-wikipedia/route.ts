import { NextResponse } from "next/server";
import { enrichAllPlayersFromWikipedia } from "@/lib/player-wikipedia-enrich";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const onlyMissing = body.onlyMissing !== false;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    const summary = await enrichAllPlayersFromWikipedia({
      onlyMissing,
      limit,
      delayMs: 400,
    });
    return NextResponse.json(summary);
  } catch (e) {
    return apiErrorResponse(e, "Failed to enrich players from Wikipedia");
  }
}
