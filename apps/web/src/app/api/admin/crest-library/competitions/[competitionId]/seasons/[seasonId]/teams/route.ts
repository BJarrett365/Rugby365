import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listCrestLibraryTeams } from "@/lib/crest-library-service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ competitionId: string; seasonId: string }> },
) {
  try {
    const { competitionId, seasonId } = await ctx.params;
    const teams = await listCrestLibraryTeams(competitionId, seasonId);
    return NextResponse.json({ ok: true, teams });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load teams");
  }
}
