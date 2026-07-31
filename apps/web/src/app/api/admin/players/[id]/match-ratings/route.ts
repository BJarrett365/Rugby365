import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { getPlayerMatchRatingsHistory } from "@/lib/player-match-ratings-history-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const [player] = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const history = await getPlayerMatchRatingsHistory(player.id, player.name);
    return NextResponse.json(history);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match ratings history");
  }
}
