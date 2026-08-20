import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCoachHonour,
  deleteCoachHonour,
  listCoachHonours,
} from "@/lib/coach-history-cms-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await listCoachHonours(id);
    return NextResponse.json({ honours: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load honours");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const row = await createCoachHonour(id, {
      roleType: body.roleType ? String(body.roleType) : undefined,
      teamId: body.teamId ? String(body.teamId) : null,
      teamName: body.teamName ? String(body.teamName) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      competitionName: body.competitionName ? String(body.competitionName) : null,
      seasonId: body.seasonId ? String(body.seasonId) : null,
      seasonLabel: body.seasonLabel ? String(body.seasonLabel) : null,
      year: body.year as number | string | null | undefined,
      achievementType: body.achievementType ? String(body.achievementType) : undefined,
      honourLevel: body.honourLevel ? String(body.honourLevel) : undefined,
      shared: body.shared !== undefined ? Boolean(body.shared) : undefined,
      position: body.position ? String(body.position) : null,
      notes: body.notes ? String(body.notes) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      showOnOverview: body.showOnOverview !== undefined ? Boolean(body.showOnOverview) : undefined,
      visibility: body.visibility ? String(body.visibility) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ honour: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create honour");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const honourId = url.searchParams.get("id");
    if (!honourId) {
      return NextResponse.json({ error: "Missing honour id" }, { status: 400 });
    }
    const ok = await deleteCoachHonour(honourId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete honour");
  }
}
