import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  addShirtReference,
  createShirtVersion,
  getShirtDetail,
  updateDraftShirtVersion,
  updateShirtUsageFlags,
} from "@/lib/shirt-library-service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shirtId: string }> },
) {
  try {
    const { shirtId } = await ctx.params;
    const detail = await getShirtDetail(shirtId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: detail });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load shirt");
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shirtId: string }> },
) {
  try {
    const { shirtId } = await ctx.params;
    const body = (await req.json()) as {
      action?: string;
      versionId?: string;
      version?: Parameters<typeof updateDraftShirtVersion>[1];
      usage?: Parameters<typeof updateShirtUsageFlags>[1];
      reference?: {
        imageUrl: string;
        imageType?: string;
        sourceUrl?: string;
        sourceName?: string;
        notes?: string;
        seasonLabel?: string;
      };
    };

    if (body.action === "new-version" && body.version) {
      const version = await createShirtVersion(shirtId, body.version, "cms");
      return NextResponse.json({ ok: true, version });
    }
    if (body.action === "update-version" && body.versionId && body.version) {
      const version = await updateDraftShirtVersion(body.versionId, body.version, "cms");
      return NextResponse.json({ ok: true, version });
    }
    if (body.action === "usage" && body.usage) {
      await updateShirtUsageFlags(shirtId, body.usage, "cms");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "add-reference" && body.reference?.imageUrl) {
      const reference = await addShirtReference({
        shirtId,
        ...body.reference,
        uploadedBy: "cms",
      });
      return NextResponse.json({ ok: true, reference });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update shirt");
  }
}
