import { NextResponse } from "next/server";
import { createTeam } from "@/lib/entity-admin-service";
import { listTeams } from "@/lib/fixture-admin-service";
import { listTeamPickerData } from "@/lib/team-picker-service";
import { collapseAdminClubCatalog } from "@/lib/admin-clubs-catalog";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const grouped = searchParams.get("grouped") === "1";
    if (grouped) {
      const competitionId = searchParams.get("competitionId") ?? undefined;
      const seasonId = searchParams.get("seasonId") ?? undefined;
      const payload = await listTeamPickerData(
        competitionId && seasonId ? { competitionId, seasonId } : undefined,
      );
      return NextResponse.json(payload);
    }
    const teams = await listTeams();
    if (searchParams.get("catalog") === "1") {
      return NextResponse.json({ teams: collapseAdminClubCatalog(teams) });
    }
    return NextResponse.json({ teams });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list teams");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const team = await createTeam({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      shortName: body.shortName ? String(body.shortName) : undefined,
      externalProviderId: body.externalProviderId ? String(body.externalProviderId) : undefined,
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create team";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
