import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getApprovedShirtsForTeam } from "@/lib/shirt-library-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await ctx.params;
    const seasonId = new URL(req.url).searchParams.get("seasonId") ?? undefined;
    const shirts = await getApprovedShirtsForTeam(teamId, seasonId);
    return NextResponse.json({ ok: true, shirts });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load approved shirts");
  }
}
