import { NextResponse } from "next/server";
import { deleteLegend, getLegendById, updateLegend } from "@/lib/legend-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const legend = await getLegendById(id);
    if (!legend) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ legend });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load legend");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const legend = await updateLegend(id, {
      ...(body.legendStatus !== undefined
        ? { legendStatus: body.legendStatus === "inactive" ? "inactive" : "active" }
        : {}),
      ...(body.legendLevel !== undefined ? { legendLevel: String(body.legendLevel) } : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId ? String(body.teamId) : null } : {}),
      ...(body.competitionId !== undefined
        ? { competitionId: body.competitionId ? String(body.competitionId) : null }
        : {}),
      ...(body.countryName !== undefined ? { countryName: body.countryName ? String(body.countryName) : null } : {}),
      ...(body.internationalTeamId !== undefined
        ? { internationalTeamId: body.internationalTeamId ? String(body.internationalTeamId) : null }
        : {}),
      ...(body.era !== undefined ? { era: body.era ? String(body.era) : null } : {}),
      ...(body.reason !== undefined ? { reason: body.reason ? String(body.reason) : null } : {}),
      ...(body.careerSummary !== undefined
        ? { careerSummary: body.careerSummary ? String(body.careerSummary) : null }
        : {}),
      ...(body.keyAchievements !== undefined && Array.isArray(body.keyAchievements)
        ? { keyAchievements: body.keyAchievements.map(String) }
        : {}),
      ...(body.notableStats !== undefined && typeof body.notableStats === "object"
        ? { notableStats: body.notableStats as Record<string, unknown> }
        : {}),
      ...(body.editorNotes !== undefined ? { editorNotes: body.editorNotes ? String(body.editorNotes) : null } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null } : {}),
    });
    return NextResponse.json({ legend });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update legend";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteLegend(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete legend";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
