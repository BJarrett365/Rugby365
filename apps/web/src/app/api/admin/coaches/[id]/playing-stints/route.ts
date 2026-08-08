import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCoachPlayingStint,
  deleteCoachPlayingStint,
  listCoachPlayingStints,
} from "@/lib/coach-history-cms-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await listCoachPlayingStints(id);
    return NextResponse.json({ playingStints: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load playing stints");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.yearsLabel || !String(body.yearsLabel).trim()) {
      return NextResponse.json({ error: "yearsLabel is required" }, { status: 400 });
    }
    if (!body.teamName || !String(body.teamName).trim()) {
      return NextResponse.json({ error: "teamName is required" }, { status: 400 });
    }
    const row = await createCoachPlayingStint(id, {
      teamType: body.teamType ? String(body.teamType) : undefined,
      startYear: body.startYear as number | string | null | undefined,
      endYear: body.endYear as number | string | null | undefined,
      yearsLabel: String(body.yearsLabel),
      teamName: String(body.teamName),
      teamId: body.teamId ? String(body.teamId) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      country: body.country ? String(body.country) : null,
      apps: body.apps as number | string | null | undefined,
      starts: body.starts as number | string | null | undefined,
      points: body.points as number | string | null | undefined,
      tries: body.tries as number | string | null | undefined,
      position: body.position ? String(body.position) : null,
      captain: body.captain !== undefined ? Boolean(body.captain) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      showOnOverview: body.showOnOverview !== undefined ? Boolean(body.showOnOverview) : undefined,
    });
    return NextResponse.json({ playingStint: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create playing stint");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const stintId = url.searchParams.get("id");
    if (!stintId) {
      return NextResponse.json({ error: "Missing stint id" }, { status: 400 });
    }
    const ok = await deleteCoachPlayingStint(stintId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete playing stint");
  }
}
