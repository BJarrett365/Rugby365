import { NextResponse } from "next/server";
import {
  getCoachImageSummary,
  setCoachPrimaryFromUrl,
  uploadCoachPrimaryImage,
} from "@/lib/coach-image-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const summary = await getCoachImageSummary(id);
    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(summary);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list coach images");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const row = await uploadCoachPrimaryImage({
        coachId: id,
        bytes,
        contentType: file.type || "image/jpeg",
        fileName: file.name,
        credit: form.get("credit") ? String(form.get("credit")) : null,
      });
      const summary = await getCoachImageSummary(id);
      return NextResponse.json({ ok: true, image: row, ...summary });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "set_from_url");

    if (action === "set_from_url" || action === "set_primary") {
      const imageUrl = String(body.imageUrl ?? "").trim();
      if (!imageUrl) {
        return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
      }
      const row = await setCoachPrimaryFromUrl({
        coachId: id,
        imageUrl,
        sourceProvider: body.sourceProvider ? String(body.sourceProvider) : "manual_url",
        sourcePageUrl: body.sourcePageUrl ? String(body.sourcePageUrl) : null,
      });
      const summary = await getCoachImageSummary(id);
      return NextResponse.json({ ok: true, image: row, ...summary });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update coach image");
  }
}
