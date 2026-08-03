import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { archiveShirt } from "@/lib/shirt-library-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ shirtId: string }> },
) {
  try {
    const { shirtId } = await ctx.params;
    await archiveShirt(shirtId, "cms");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to archive shirt");
  }
}
