import { NextResponse } from "next/server";
import { deleteTeam, getTeamDetail, repairTeamPlayerDisplayNames, updateTeam } from "@/lib/entity-admin-service";
import { getTeamTransferHistory } from "@/lib/transfer-admin-service";
import { getTeamCoachingStaff } from "@/lib/coach-admin-service";
import { getTeamLegends } from "@/lib/legend-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getTeamDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [transferHistory, coachingStaff, legends] = await Promise.all([
      getTeamTransferHistory(id),
      getTeamCoachingStaff(id),
      getTeamLegends(id),
    ]);
    return NextResponse.json({ ...detail, transferHistory, coachingStaff, legends });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "repair-player-names") {
      const result = await repairTeamPlayerDisplayNames(id);
      return NextResponse.json(result);
    }

    const team = await updateTeam(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.shortName !== undefined ? { shortName: String(body.shortName) } : {}),
      ...(body.externalProviderId !== undefined
        ? { externalProviderId: String(body.externalProviderId) }
        : {}),
      ...(body.homeVenueId !== undefined
        ? { homeVenueId: body.homeVenueId ? String(body.homeVenueId) : null }
        : {}),
      ...(body.countryName !== undefined
        ? { countryName: body.countryName ? String(body.countryName) : null }
        : {}),
      ...(body.region !== undefined ? { region: body.region ? String(body.region) : null } : {}),
      ...(body.hemisphere !== undefined
        ? { hemisphere: body.hemisphere ? String(body.hemisphere) : null }
        : {}),
      ...(body.teamType !== undefined ? { teamType: body.teamType ? String(body.teamType) : null } : {}),
    });
    return NextResponse.json({ team });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update team";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteTeam(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete team";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
