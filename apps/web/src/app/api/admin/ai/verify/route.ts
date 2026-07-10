import { NextResponse } from "next/server";
import type { AiEntityType } from "@/lib/ai-enrichment-types";
import {
  listAiVerificationReports,
  markVerificationReportReviewed,
  runAiVerification,
} from "@/lib/ai-verification-service";
import { apiErrorResponse } from "@/lib/api-errors";

type VerifyBody = {
  entityType: AiEntityType;
  entityId: string;
  action?: "create" | "review";
  reportId?: string;
  reviewedBy?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as AiEntityType | null;
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId || (entityType !== "player" && entityType !== "team")) {
      return NextResponse.json(
        { error: "entityType (player|team) and entityId are required" },
        { status: 400 },
      );
    }

    const reports = await listAiVerificationReports(entityType, entityId);
    return NextResponse.json({ reports });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load AI verification reports");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyBody;
    if (!body.entityType || !body.entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }
    if (body.entityType !== "player" && body.entityType !== "team") {
      return NextResponse.json({ error: "entityType must be player or team" }, { status: 400 });
    }

    if (body.action === "review") {
      if (!body.reportId) {
        return NextResponse.json({ error: "reportId is required to review" }, { status: 400 });
      }
      const report = await markVerificationReportReviewed({
        id: body.reportId,
        reviewedBy: body.reviewedBy?.trim() || "cms-editor",
      });
      return NextResponse.json({ report });
    }

    const report = await runAiVerification({
      entityType: body.entityType,
      entityId: body.entityId,
    });
    return NextResponse.json({ report });
  } catch (e) {
    return apiErrorResponse(e, "Failed to run AI verification");
  }
}
