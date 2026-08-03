import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listShirtsForTeamSeason } from "@/lib/shirt-library-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const seasonId = searchParams.get("seasonId");
    if (!competitionId || !seasonId) {
      return NextResponse.json(
        { error: "competitionId and seasonId are required" },
        { status: 400 },
      );
    }
    const shirts = await listShirtsForTeamSeason({ teamId, competitionId, seasonId });
    return NextResponse.json({ ok: true, shirts });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team shirts");
  }
}
