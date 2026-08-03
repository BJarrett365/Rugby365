import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { buildPlayerCompareMetrics } from "@/lib/player-compare-metrics";
import { getPublicPlayerProfile } from "@/lib/public-player-profile-service";

/** Public head-to-head payload for the compare picker (inline results). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a")?.trim() ?? "";
    const b = searchParams.get("b")?.trim() ?? "";
    const preview = searchParams.get("preview") === "1";

    if (!a || !b) {
      return NextResponse.json({ error: "Pick two players (a and b)." }, { status: 400 });
    }
    if (a === b) {
      return NextResponse.json({ error: "Pick two different players." }, { status: 400 });
    }

    const [playerA, playerB] = await Promise.all([
      getPublicPlayerProfile(a, { preview }),
      getPublicPlayerProfile(b, { preview }),
    ]);

    if (!playerA || !playerB) {
      return NextResponse.json({ error: "One or both players were not found." }, { status: 404 });
    }

    return NextResponse.json({
      playerA,
      playerB,
      rankingsA: playerA.rankings ?? null,
      rankingsB: playerB.rankings ?? null,
      metrics: buildPlayerCompareMetrics(playerA, playerB),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player comparison");
  }
}
