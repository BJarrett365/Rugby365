import { NextResponse } from "next/server";
import type { WorldRugbyRankingCategory } from "@rugby365/import-sdk";
import {
  applyWorldRankingForFixture,
  previewWorldRankingExchange,
} from "@/lib/world-rugby-ranking-calc-service";
import { apiErrorResponse } from "@/lib/api-errors";

type Body = {
  action?: "apply" | "preview";
  fixtureId?: string;
  category?: WorldRugbyRankingCategory;
  force?: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  asOf?: string;
  neutralVenue?: boolean;
  isWorldCup?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const action = body.action ?? "apply";

    if (action === "preview") {
      if (!body.homeTeamId || !body.awayTeamId) {
        return NextResponse.json(
          { error: "homeTeamId and awayTeamId are required for preview" },
          { status: 400 },
        );
      }
      const result = await previewWorldRankingExchange({
        category: body.category,
        homeTeamId: body.homeTeamId,
        awayTeamId: body.awayTeamId,
        homeScore: body.homeScore ?? 0,
        awayScore: body.awayScore ?? 0,
        asOf: body.asOf,
        neutralVenue: body.neutralVenue,
        isWorldCup: body.isWorldCup,
      });
      return NextResponse.json(result);
    }

    if (!body.fixtureId) {
      return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
    }

    const result = await applyWorldRankingForFixture(body.fixtureId, {
      category: body.category,
      force: body.force,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to calculate world rankings");
  }
}
