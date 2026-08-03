import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { approveCrestVersion } from "@/lib/crest-library-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ crestId: string }> },
) {
  try {
    const { crestId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      versionId?: string;
      notes?: string;
    };
    const result = await approveCrestVersion(crestId, {
      versionId: body.versionId,
      notes: body.notes,
      reviewedBy: "cms",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to approve crest");
  }
}
