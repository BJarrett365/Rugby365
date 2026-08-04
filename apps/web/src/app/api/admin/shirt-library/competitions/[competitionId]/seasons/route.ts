import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listShirtLibrarySeasons } from "@/lib/shirt-library-service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ competitionId: string }> },
) {
  try {
    const { competitionId } = await ctx.params;
    const seasons = await listShirtLibrarySeasons(competitionId);
    return NextResponse.json({ ok: true, seasons });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load seasons");
  }
}
