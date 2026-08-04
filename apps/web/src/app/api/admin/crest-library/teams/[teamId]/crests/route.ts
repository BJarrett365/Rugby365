import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listTeamCrests } from "@/lib/crest-library-service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await ctx.params;
    const crests = await listTeamCrests(teamId);
    return NextResponse.json({ ok: true, crests });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team crests");
  }
}
