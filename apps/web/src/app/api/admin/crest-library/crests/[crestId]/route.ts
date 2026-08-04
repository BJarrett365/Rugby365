import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCrestVersion,
  getCrestDetail,
  updateDraftCrestVersion,
} from "@/lib/crest-library-service";
import type { CrestVersionInput } from "@/lib/crest-library-types";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ crestId: string }> },
) {
  try {
    const { crestId } = await ctx.params;
    const detail = await getCrestDetail(crestId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Crest not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load crest");
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ crestId: string }> },
) {
  try {
    const { crestId } = await ctx.params;
    const body = (await req.json()) as {
      action?: "update-draft" | "new-version";
      versionId?: string;
      version?: CrestVersionInput;
    };

    if (!body.version) {
      return NextResponse.json({ ok: false, error: "version is required" }, { status: 400 });
    }

    if (body.action === "new-version") {
      const version = await createCrestVersion(crestId, body.version, "cms");
      return NextResponse.json({ ok: true, version });
    }

    if (!body.versionId) {
      return NextResponse.json(
        { ok: false, error: "versionId is required for update-draft" },
        { status: 400 },
      );
    }

    const version = await updateDraftCrestVersion(body.versionId, body.version, "cms");
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update crest");
  }
}
