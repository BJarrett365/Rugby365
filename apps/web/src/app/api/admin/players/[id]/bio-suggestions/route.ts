import { NextResponse } from "next/server";
import {
  getPlayerBioAutomationState,
  listPlayerBioSuggestions,
  queuePlayerBioRefresh,
  suggestPlayerBio,
} from "@/lib/player-bio-automation-service";
import type { PlayerBioType } from "@/lib/player-bio-types";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const bioType = searchParams.get("bioType") as PlayerBioType | null;
    const [state, suggestions] = await Promise.all([
      getPlayerBioAutomationState(id),
      listPlayerBioSuggestions(id, bioType ?? undefined),
    ]);
    return NextResponse.json({ ...state, suggestions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player bio suggestions");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      bioType?: PlayerBioType;
      triggerReason?: string;
      force?: boolean;
      action?: "suggest" | "queue";
    };

    if (body.action === "queue") {
      const result = await queuePlayerBioRefresh({
        playerId: id,
        trigger: "manual",
        bioType: body.bioType,
        force: body.force ?? false,
      });
      return NextResponse.json(result);
    }

    const suggestion = await suggestPlayerBio({
      playerId: id,
      bioType: body.bioType,
      triggerReason: body.triggerReason ?? "Manual bio suggestion requested",
    });
    return NextResponse.json({ suggestion });
  } catch (e) {
    return apiErrorResponse(e, "Failed to generate player bio suggestion");
  }
}
