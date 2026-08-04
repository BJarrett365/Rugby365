import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requestCrestChanges } from "@/lib/crest-library-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ crestId: string }> },
) {
  try {
    const { crestId } = await ctx.params;
    const body = (await req.json()) as { notes?: string; versionId?: string };
    if (!body.notes?.trim()) {
      return NextResponse.json({ ok: false, error: "notes required" }, { status: 400 });
    }
    await requestCrestChanges(crestId, body.notes, "cms", body.versionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to request crest changes");
  }
}
