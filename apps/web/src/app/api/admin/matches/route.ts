import { NextResponse } from "next/server";
import { listAllSeasons, listCompetitions } from "@/lib/competition-admin-service";
import { createFixture, listFixtures, listFixturesCms, listTeams } from "@/lib/fixture-admin-service";
import { hasRequiredMatchCmsFilters } from "@/lib/match-cms-date-bounds";
import {
  MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE,
  parseMatchCmsFilters,
} from "@/lib/match-cms-list-utils";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    // Explicit legacy full dump only — never unrestricted by default.
    if (mode === "legacy" || mode === "full") {
      const [fixtureRows, teams, competitions] = await Promise.all([
        listFixtures(),
        listTeams(),
        listCompetitions(),
      ]);
      return NextResponse.json({ fixtures: fixtureRows, teams, competitions });
    }

    const hasCmsParams =
      mode === "cms" ||
      url.searchParams.has("from") ||
      url.searchParams.has("to") ||
      url.searchParams.has("competitionId") ||
      url.searchParams.has("seasonId") ||
      url.searchParams.has("status") ||
      url.searchParams.has("provider") ||
      url.searchParams.has("q") ||
      url.searchParams.has("team") ||
      url.searchParams.has("page") ||
      url.searchParams.has("sort") ||
      url.searchParams.has("ops");

    if (!hasCmsParams) {
      return NextResponse.json(
        {
          error: MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE,
          idle: true,
          hint: "Pass mode=cms with from and to (competitionId optional) — or mode=legacy for the full dump.",
        },
        { status: 400 },
      );
    }

    const filters = parseMatchCmsFilters(url.searchParams);
    const isTodayOps = filters.ops === "today";
    // Today ops may omit from/to (server defaults to today). Competition is optional (all games).
    const incomplete = isTodayOps ? false : !hasRequiredMatchCmsFilters(filters);

    if (incomplete) {
      return NextResponse.json(
        { error: MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE, idle: true },
        { status: 400 },
      );
    }

    const [result, competitions, seasons] = await Promise.all([
      listFixturesCms(filters),
      listCompetitions(),
      listAllSeasons(filters.competitionId ?? undefined),
    ]);

    return NextResponse.json({
      ...result,
      competitions: competitions.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      seasons: seasons.map((s) => ({
        id: s.id,
        label: s.label,
        competitionId: s.competitionId,
        competitionName: s.competitionName,
      })),
      filters,
    });
  } catch (e) {
    if (e instanceof Error && e.message === MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE) {
      return NextResponse.json({ error: e.message, idle: true }, { status: 400 });
    }
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
      competitionId: body.competitionId ? String(body.competitionId) : null,
      competitionName: body.competitionName ? String(body.competitionName) : undefined,
      seasonId: body.seasonId !== undefined ? (body.seasonId ? String(body.seasonId) : null) : undefined,
      kickoffAt: body.kickoffAt ? String(body.kickoffAt) : null,
      status: body.status ? String(body.status) : undefined,
      sport365Url: body.sport365Url ? String(body.sport365Url) : null,
      planetRugbyUrl: body.planetRugbyUrl ? String(body.planetRugbyUrl) : null,
      externalMatchId: body.externalMatchId ? String(body.externalMatchId) : null,
      venueId: body.venueId ? String(body.venueId) : null,
      attendance: body.attendance != null && body.attendance !== "" ? Number(body.attendance) : null,
      halfTimeHome:
        body.halfTimeHome != null && body.halfTimeHome !== "" ? Number(body.halfTimeHome) : null,
      halfTimeAway:
        body.halfTimeAway != null && body.halfTimeAway !== "" ? Number(body.halfTimeAway) : null,
      additionalInfo: body.additionalInfo ? String(body.additionalInfo) : null,
      weatherNote: body.weatherNote ? String(body.weatherNote) : null,
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
