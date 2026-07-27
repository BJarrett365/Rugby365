import { NextResponse } from "next/server";
import { deleteFixture, getFixtureAdminDetail, updateFixture } from "@/lib/fixture-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getFixtureAdminDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const fixture = await updateFixture(id, {
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.homeTeamId !== undefined ? { homeTeamId: String(body.homeTeamId) } : {}),
      ...(body.awayTeamId !== undefined ? { awayTeamId: String(body.awayTeamId) } : {}),
      ...(body.competitionId !== undefined
        ? { competitionId: body.competitionId ? String(body.competitionId) : null }
        : {}),
      ...(body.competitionName !== undefined
        ? { competitionName: body.competitionName ? String(body.competitionName) : "" }
        : {}),
      ...(body.seasonId !== undefined
        ? { seasonId: body.seasonId ? String(body.seasonId) : null }
        : {}),
      ...(body.kickoffAt !== undefined
        ? { kickoffAt: body.kickoffAt ? String(body.kickoffAt) : null }
        : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.sport365Url !== undefined
        ? { sport365Url: body.sport365Url ? String(body.sport365Url) : null }
        : {}),
      ...(body.planetRugbyUrl !== undefined
        ? { planetRugbyUrl: body.planetRugbyUrl ? String(body.planetRugbyUrl) : null }
        : {}),
      ...(body.watchalongYoutubeUrl !== undefined
        ? {
            watchalongYoutubeUrl: body.watchalongYoutubeUrl
              ? String(body.watchalongYoutubeUrl)
              : null,
          }
        : {}),
      ...(body.highlightsYoutubeUrl !== undefined
        ? {
            highlightsYoutubeUrl: body.highlightsYoutubeUrl
              ? String(body.highlightsYoutubeUrl)
              : null,
          }
        : {}),
      ...(body.externalMatchId !== undefined
        ? { externalMatchId: body.externalMatchId ? String(body.externalMatchId) : null }
        : {}),
      ...(body.venueId !== undefined ? { venueId: body.venueId ? String(body.venueId) : null } : {}),
      ...(body.attendance !== undefined
        ? { attendance: body.attendance === null || body.attendance === "" ? null : Number(body.attendance) }
        : {}),
      ...(body.refereeId !== undefined ? { refereeId: body.refereeId ? String(body.refereeId) : null } : {}),
      ...(body.homeCoachId !== undefined ? { homeCoachId: body.homeCoachId ? String(body.homeCoachId) : null } : {}),
      ...(body.awayCoachId !== undefined ? { awayCoachId: body.awayCoachId ? String(body.awayCoachId) : null } : {}),
      ...(body.round !== undefined ? { round: body.round ? String(body.round) : null } : {}),
    });
    return NextResponse.json({ fixture });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update match";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteFixture(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete match";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
