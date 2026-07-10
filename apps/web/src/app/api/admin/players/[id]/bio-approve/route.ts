import { NextResponse } from "next/server";
import {
  approvePlayerBioSuggestion,
  rejectPlayerBioSuggestion,
} from "@/lib/player-bio-automation-service";
import type { PlayerBioSections } from "@/lib/player-bio-types";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _playerId } = await params;
    const body = (await request.json()) as {
      suggestionId: string;
      action: "approve" | "reject";
      approvedBy?: string;
      rejectedBy?: string;
      sections?: Partial<PlayerBioSections>;
    };

    if (!body.suggestionId || !body.action) {
      return NextResponse.json({ error: "suggestionId and action are required" }, { status: 400 });
    }

    if (body.action === "approve") {
      const suggestion = await approvePlayerBioSuggestion({
        suggestionId: body.suggestionId,
        approvedBy: body.approvedBy?.trim() || "cms-editor",
        sections: body.sections,
      });
      return NextResponse.json({ suggestion });
    }

    const suggestion = await rejectPlayerBioSuggestion({
      suggestionId: body.suggestionId,
      rejectedBy: body.rejectedBy?.trim() || "cms-editor",
    });
    return NextResponse.json({ suggestion });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update player bio suggestion");
  }
}
