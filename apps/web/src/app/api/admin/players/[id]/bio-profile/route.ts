import { NextResponse } from "next/server";
import { savePlayerBioVariant } from "@/lib/player-bio-automation-service";
import type { PlayerBioSections, PlayerProfileBioType } from "@/lib/player-bio-types";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: playerId } = await params;
    const body = (await request.json()) as {
      bioType?: PlayerProfileBioType;
      sections?: Partial<PlayerBioSections>;
      savedBy?: string;
      changeSummary?: string;
    };

    if (!body.bioType || !body.sections) {
      return NextResponse.json({ error: "bioType and sections are required" }, { status: 400 });
    }

    if (!["domestic", "international", "scouting"].includes(body.bioType)) {
      return NextResponse.json({ error: "Invalid bioType" }, { status: 400 });
    }

    const result = await savePlayerBioVariant({
      playerId,
      bioType: body.bioType,
      sections: {
        shortIntro: body.sections.shortIntro ?? "",
        fullBio: body.sections.fullBio ?? "",
        playingStyle: body.sections.playingStyle ?? "",
        strengths: body.sections.strengths ?? "",
        areasToImprove: body.sections.areasToImprove ?? "",
        careerSummary: body.sections.careerSummary ?? "",
        internationalSummary: body.sections.internationalSummary ?? "",
        currentSeasonSummary: body.sections.currentSeasonSummary ?? "",
        scoutingSummary: body.sections.scoutingSummary ?? "",
        ratingExplanation: body.sections.ratingExplanation ?? "",
        legendSummary: body.sections.legendSummary ?? "",
      },
      savedBy: body.savedBy?.trim() || "cms-editor",
      changeSummary: body.changeSummary,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save player bio profile");
  }
}
