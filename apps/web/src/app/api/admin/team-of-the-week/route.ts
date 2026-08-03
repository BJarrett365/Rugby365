import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  generateTeamOfWeek,
  getTeamOfWeekEditionBundle,
  listRoundsForSeason,
  publishTeamOfWeekEdition,
  unpublishTeamOfWeekEdition,
} from "@/lib/team-of-week-service";
import { presentTeamOfWeekBundle } from "@/lib/team-of-week-public";
import { desc } from "drizzle-orm";
import { teamOfWeekEditions } from "@rugby365/db";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const seasonId = searchParams.get("seasonId");
    const editionId = searchParams.get("editionId");

    if (editionId) {
      const bundle = await getTeamOfWeekEditionBundle(editionId);
      if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true, data: presentTeamOfWeekBundle(bundle) });
    }

    if (competitionId && seasonId) {
      const rounds = await listRoundsForSeason({ competitionId, seasonId });
      return NextResponse.json({ ok: true, rounds });
    }

    const db = getDb();
    const recent = await db
      .select()
      .from(teamOfWeekEditions)
      .orderBy(desc(teamOfWeekEditions.updatedAt))
      .limit(40);
    return NextResponse.json({ ok: true, editions: recent });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Team of the Week");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      competitionId?: string;
      seasonId?: string;
      roundKey?: string;
      editionId?: string;
      forceProvisional?: boolean;
      allowProvisional?: boolean;
    };

    if (body.action === "publish" && body.editionId) {
      const published = await publishTeamOfWeekEdition(body.editionId, "cms", {
        allowProvisional: Boolean(body.allowProvisional),
      });
      return NextResponse.json({ ok: true, ...published });
    }
    if (body.action === "unpublish" && body.editionId) {
      await unpublishTeamOfWeekEdition(body.editionId);
      return NextResponse.json({ ok: true });
    }

    if (!body.competitionId || !body.seasonId || !body.roundKey) {
      return NextResponse.json(
        { error: "competitionId, seasonId and roundKey are required" },
        { status: 400 },
      );
    }

    const result = await generateTeamOfWeek({
      competitionId: body.competitionId,
      seasonId: body.seasonId,
      roundKey: body.roundKey,
      createdBy: "cms",
      forceProvisional: body.forceProvisional,
    });

    const bundle = await getTeamOfWeekEditionBundle(result.editionId);
    return NextResponse.json({
      ok: true,
      ...result,
      data: bundle ? presentTeamOfWeekBundle(bundle) : null,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to generate Team of the Week");
  }
}
