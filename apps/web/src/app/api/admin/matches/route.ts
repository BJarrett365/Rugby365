import { NextResponse } from "next/server";
import { listCompetitions } from "@/lib/competition-admin-service";
import { createFixture, listFixtures, listTeams } from "@/lib/fixture-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const [fixtures, teams, competitions] = await Promise.all([
      listFixtures(),
      listTeams(),
      listCompetitions(),
    ]);
    return NextResponse.json({ fixtures, teams, competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list matches");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fixture = await createFixture({
      slug: String(body.slug ?? ""),
      homeTeamId: String(body.homeTeamId ?? ""),
      awayTeamId: String(body.awayTeamId ?? ""),
      competitionName: body.competitionName ? String(body.competitionName) : undefined,
      kickoffAt: body.kickoffAt ? String(body.kickoffAt) : null,
      status: body.status ? String(body.status) : undefined,
      sport365Url: body.sport365Url ? String(body.sport365Url) : null,
      planetRugbyUrl: body.planetRugbyUrl ? String(body.planetRugbyUrl) : null,
      externalMatchId: body.externalMatchId ? String(body.externalMatchId) : null,
      venueId: body.venueId ? String(body.venueId) : null,
      attendance: body.attendance != null && body.attendance !== "" ? Number(body.attendance) : null,
      refereeId: body.refereeId ? String(body.refereeId) : null,
      homeCoachId: body.homeCoachId ? String(body.homeCoachId) : null,
      awayCoachId: body.awayCoachId ? String(body.awayCoachId) : null,
      round: body.round ? String(body.round) : null,
    });
    return NextResponse.json({ fixture }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create match";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
