import { NextResponse } from "next/server";
import {
  approvePersonBioSuggestion,
  getPersonBioAutomationState,
  rejectPersonBioSuggestion,
  suggestPersonBio,
} from "@/lib/person-bio-automation-service";
import type { PersonBioType } from "@/lib/person-intelligence-types";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getPersonBioAutomationState(id);
    return NextResponse.json(state);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load person bio automation");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      bioType?: PersonBioType;
      triggerReason?: string;
      action?: "suggest" | "approve" | "reject";
      suggestionId?: string;
      sections?: Record<string, string>;
    };

    if (body.action === "approve") {
      if (!body.suggestionId) {
        return NextResponse.json({ error: "suggestionId required" }, { status: 400 });
      }
      const suggestion = await approvePersonBioSuggestion({
        suggestionId: body.suggestionId,
        approvedBy: "cms-editor",
        sections: body.sections,
      });
      return NextResponse.json({ suggestion });
    }

    if (body.action === "reject") {
      if (!body.suggestionId) {
        return NextResponse.json({ error: "suggestionId required" }, { status: 400 });
      }
      const suggestion = await rejectPersonBioSuggestion({
        suggestionId: body.suggestionId,
        rejectedBy: "cms-editor",
      });
      return NextResponse.json({ suggestion });
    }

    const suggestion = await suggestPersonBio({
      personId: id,
      bioType: body.bioType,
      triggerReason: body.triggerReason ?? "Manual bio generation",
    });
    return NextResponse.json({ suggestion });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update person bio");
  }
}
