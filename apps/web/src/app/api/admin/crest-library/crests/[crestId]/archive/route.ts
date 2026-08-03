import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { archiveCrest } from "@/lib/crest-library-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ crestId: string }> },
) {
  try {
    const { crestId } = await ctx.params;
    await archiveCrest(crestId, "cms");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to archive crest");
  }
}
