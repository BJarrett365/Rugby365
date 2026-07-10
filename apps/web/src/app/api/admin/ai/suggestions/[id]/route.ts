import { NextResponse } from "next/server";
import {
  approveAiEnrichmentSuggestion,
  getAiEnrichmentSuggestion,
  rejectAiEnrichmentSuggestion,
} from "@/lib/ai-enrichment-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const suggestion = await getAiEnrichmentSuggestion(id);
    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ suggestion });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load AI suggestion");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      action: "approve" | "reject";
      approvedBy?: string;
      rejectedBy?: string;
      approvedFields?: string[];
      allowOverwrite?: boolean;
    };

    if (body.action === "approve") {
      const suggestion = await approveAiEnrichmentSuggestion({
        id,
        approvedBy: body.approvedBy?.trim() || "cms-editor",
        approvedFields: body.approvedFields ?? [],
        allowOverwrite: body.allowOverwrite ?? false,
      });
      return NextResponse.json({ suggestion });
    }

    if (body.action === "reject") {
      const suggestion = await rejectAiEnrichmentSuggestion({
        id,
        rejectedBy: body.rejectedBy?.trim() || "cms-editor",
      });
      return NextResponse.json({ suggestion });
    }

    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update AI suggestion");
  }
}
