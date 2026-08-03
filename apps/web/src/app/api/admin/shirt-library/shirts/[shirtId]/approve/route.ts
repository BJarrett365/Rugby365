import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { approveShirtVersion } from "@/lib/shirt-library-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shirtId: string }> },
) {
  try {
    const { shirtId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      versionId?: string;
      notes?: string;
    };
    await approveShirtVersion(shirtId, {
      versionId: body.versionId,
      notes: body.notes,
      reviewedBy: "cms",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to approve shirt");
  }
}
