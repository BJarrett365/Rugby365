import { NextResponse } from "next/server";
import { getFixtureAdminDetail } from "@/lib/fixture-admin-service";
import { enrichFixtureFromSdmsMatch } from "@/lib/planet-rugby-match-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as { replaceEvents?: boolean };
    const detail = await getFixtureAdminDetail(id);
    if (!detail?.fixture) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchId = detail.fixture.externalMatchId;
    if (!matchId) {
      return NextResponse.json({ error: "Fixture has no Planet Rugby / SDMS match id" }, { status: 400 });
    }

    const result = await enrichFixtureFromSdmsMatch(id, matchId, {
      planetRugbyUrl: detail.fixture.planetRugbyUrl ?? undefined,
      replaceEvents: body.replaceEvents === true,
    });

    const refreshed = await getFixtureAdminDetail(id);
    return NextResponse.json({ ok: true, result, detail: refreshed });
  } catch (e) {
    return apiErrorResponse(e, "Planet Rugby enrich failed");
  }
}
