import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCoachMilestone,
  deleteCoachMilestone,
  listCoachMilestones,
} from "@/lib/coach-history-cms-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await listCoachMilestones(id);
    return NextResponse.json({ milestones: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load milestones");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.milestoneType || !String(body.milestoneType).trim()) {
      return NextResponse.json({ error: "milestoneType is required" }, { status: 400 });
    }
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const row = await createCoachMilestone(id, {
      milestoneDate: body.milestoneDate ? String(body.milestoneDate) : null,
      milestoneYear: body.milestoneYear as number | string | null | undefined,
      milestoneType: String(body.milestoneType),
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      teamId: body.teamId ? String(body.teamId) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      matchId: body.matchId ? String(body.matchId) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      showOnOverview: body.showOnOverview !== undefined ? Boolean(body.showOnOverview) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ milestone: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create milestone");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get("id");
    if (!milestoneId) {
      return NextResponse.json({ error: "Missing milestone id" }, { status: 400 });
    }
    const ok = await deleteCoachMilestone(milestoneId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete milestone");
  }
}
