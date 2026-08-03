import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCrestDraft,
  listCrestLibraryCompetitions,
  seedCurrieCupCrestDrafts,
  seedNpcCrestDrafts,
  seedPremiershipCrestDrafts,
} from "@/lib/crest-library-service";
import type { CrestVersionInput } from "@/lib/crest-library-types";

export async function GET() {
  try {
    const competitions = await listCrestLibraryCompetitions();
    return NextResponse.json({ ok: true, competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load crest library competitions");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      teamId?: string;
      competitionId?: string;
      seasonId?: string;
      name?: string;
      version?: CrestVersionInput;
    };

    if (body.action === "seed-currie-cup") {
      const result = await seedCurrieCupCrestDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-npc") {
      const result = await seedNpcCrestDrafts("cms");
      return NextResponse.json(result);
    }
    if (body.action === "seed-premiership") {
      const result = await seedPremiershipCrestDrafts("cms");
      return NextResponse.json(result);
    }

    if (!body.teamId || !body.version) {
      return NextResponse.json(
        { ok: false, error: "teamId and version are required" },
        { status: 400 },
      );
    }

    const result = await createCrestDraft({
      teamId: body.teamId,
      competitionId: body.competitionId,
      seasonId: body.seasonId,
      name: body.name,
      createdBy: "cms",
      version: body.version,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create crest draft");
  }
}
