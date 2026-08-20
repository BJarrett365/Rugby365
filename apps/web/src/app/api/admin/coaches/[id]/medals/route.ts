import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCoachMedal,
  deleteCoachMedal,
  listCoachMedals,
} from "@/lib/coach-history-cms-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await listCoachMedals(id);
    return NextResponse.json({ medals: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load medals");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.finish || !String(body.finish).trim()) {
      return NextResponse.json({ error: "finish is required" }, { status: 400 });
    }
    const row = await createCoachMedal(id, {
      roleType: body.roleType ? String(body.roleType) : undefined,
      teamId: body.teamId ? String(body.teamId) : null,
      teamName: body.teamName ? String(body.teamName) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      competitionName: body.competitionName ? String(body.competitionName) : null,
      year: body.year as number | string | null | undefined,
      finish: String(body.finish),
      medalType: body.medalType ? String(body.medalType) : undefined,
      honourId: body.honourId ? String(body.honourId) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ medal: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create medal");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const medalId = url.searchParams.get("id");
    if (!medalId) {
      return NextResponse.json({ error: "Missing medal id" }, { status: 400 });
    }
    const ok = await deleteCoachMedal(medalId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete medal");
  }
}
