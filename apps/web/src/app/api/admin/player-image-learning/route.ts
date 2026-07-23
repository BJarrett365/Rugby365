import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  learnFromAllRejectedImages,
  listImageLearningRules,
  reviewImageLearningRule,
} from "@/lib/player-image-learning-service";

export async function GET(req: Request) {
  try {
    const status = new URL(req.url).searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | null;
    const rules = await listImageLearningRules(status ?? undefined);
    return NextResponse.json({ rules });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load image learning rules");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      id?: string;
      reviewedBy?: string;
    };

    if (body.action === "learn_from_rejected") {
      const result = await learnFromAllRejectedImages();
      return NextResponse.json({
        ok: true,
        scanned: result.scanned,
        created: result.created,
        pendingCount: result.pendingCount,
        pending: result.pending,
      });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (!body.id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      const row = await reviewImageLearningRule({
        id: body.id,
        action: body.action,
        reviewedBy: body.reviewedBy ?? "cms",
      });
      if (!row) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      return NextResponse.json({ ok: true, rule: row });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Image learning action failed");
  }
}
