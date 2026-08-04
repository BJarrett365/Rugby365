import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createShirtDraft,
  listShirtLibraryCompetitions,
  seedAllIrelandLeagueShirtDrafts,
  seedAutumnNationsShirtDrafts,
  seedChampionsCupShirtDrafts,
  seedCurrieCupShirtDrafts,
  updateCurrieCupShirtsForCurrentSeason,
  seedNationsChampionshipShirtDrafts,
  seedMlrShirtDrafts,
  seedNpcShirtDrafts,
  seedPremiershipShirtDrafts,
  seedSaProvincialShirtDrafts,
  seedScottishPremiershipShirtDrafts,
  seedSerieAEliteShirtDrafts,
  seedSuperRugbyPacificShirtDrafts,
  seedSuperRygbiCymruShirtDrafts,
  seedTop14ShirtDrafts,
  seedUrcShirtDrafts,
} from "@/lib/shirt-library-service";
import type { ShirtKitType } from "@/lib/shirt-library-types";

export async function GET() {
  try {
    const competitions = await listShirtLibraryCompetitions();
    return NextResponse.json({ ok: true, competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load shirt library competitions");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      teamId?: string;
      competitionId?: string;
      seasonId?: string;
      kitType?: ShirtKitType | string;
      name?: string;
      version?: {
        bodyColour: string;
        secondaryColour?: string | null;
        sleeveColour?: string | null;
        collarColour?: string | null;
        cuffColour?: string | null;
        sidePanelColour?: string | null;
        patternType?: string;
        patternColour?: string | null;
        patternSettings?: Record<string, unknown>;
        numberColour?: string;
        numberBorderColour?: string | null;
        crestEnabled?: boolean;
      };
    };

    if (body.action === "seed-nations") {
      const result = await seedNationsChampionshipShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-currie-cup") {
      const result = await seedCurrieCupShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "update-currie-cup") {
      const result = await updateCurrieCupShirtsForCurrentSeason("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-npc") {
      const result = await seedNpcShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-urc") {
      const result = await seedUrcShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-autumn-nations") {
      const result = await seedAutumnNationsShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-premiership") {
      const result = await seedPremiershipShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-sa-provincial") {
      const result = await seedSaProvincialShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-top14") {
      const result = await seedTop14ShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-mlr") {
      const result = await seedMlrShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-super-rugby") {
      const result = await seedSuperRugbyPacificShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-serie-a-elite") {
      const result = await seedSerieAEliteShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-scottish-premiership") {
      const result = await seedScottishPremiershipShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-super-rygbi-cymru") {
      const result = await seedSuperRygbiCymruShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-all-ireland-league") {
      const result = await seedAllIrelandLeagueShirtDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-champions-cup") {
      const result = await seedChampionsCupShirtDrafts("cms");
      return NextResponse.json(result);
    }

    if (
      !body.teamId ||
      !body.competitionId ||
      !body.seasonId ||
      !body.kitType ||
      !body.version?.bodyColour
    ) {
      return NextResponse.json(
        { error: "teamId, competitionId, seasonId, kitType and version.bodyColour are required" },
        { status: 400 },
      );
    }

    const created = await createShirtDraft({
      teamId: body.teamId,
      competitionId: body.competitionId,
      seasonId: body.seasonId,
      kitType: body.kitType,
      name: body.name,
      createdBy: "cms",
      version: body.version,
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create shirt draft");
  }
}
