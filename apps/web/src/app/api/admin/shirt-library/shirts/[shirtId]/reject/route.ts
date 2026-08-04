import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { rejectShirtVersion } from "@/lib/shirt-library-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shirtId: string }> },
) {
  try {
    const { shirtId } = await ctx.params;
    const body = (await req.json()) as { notes?: string; versionId?: string };
    if (!body.notes?.trim()) {
      return NextResponse.json({ error: "notes are required" }, { status: 400 });
    }
    await rejectShirtVersion(shirtId, body.notes, "cms", body.versionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to reject shirt");
  }
}
