import { NextResponse } from "next/server";
import {
  deleteCoachingStaffAssignment,
  getTeamCoachingStaff,
  upsertCoachingStaffAssignment,
} from "@/lib/coach-admin-service";
import { getCoachIntelligenceSummaries } from "@/lib/coach-intelligence-service";
import { apiErrorResponse } from "@/lib/api-errors";

async function enrichCoachingStaff(teamId: string) {
  const coachingStaff = await getTeamCoachingStaff(teamId);
  const coachIds = [
    ...coachingStaff.current.map((row) => row.coachId),
    ...coachingStaff.past.map((row) => row.coachId),
  ];
  const intelligence = await getCoachIntelligenceSummaries(coachIds);
  const attach = (row: (typeof coachingStaff.current)[number]) => ({
    ...row,
    coachRating: intelligence[row.coachId]?.coachRating ?? null,
    bioStatus: intelligence[row.coachId]?.bioStatus ?? "none",
  });
  return {
    current: coachingStaff.current.map(attach),
    past: coachingStaff.past.map(attach),
    bySeason: coachingStaff.bySeason.map(({ season, items }) => ({
      season,
      items: items.map(attach),
    })),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const coachingStaff = await enrichCoachingStaff(id);
    return NextResponse.json({ coachingStaff });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load coaching staff");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: teamId } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const result = await upsertCoachingStaffAssignment({
      teamId,
      coachId: String(body.coachId ?? ""),
      seasonId: body.seasonId ? String(body.seasonId) : null,
      role: String(body.role ?? "other"),
      startDate: body.startDate ? String(body.startDate) : null,
      endDate: body.endDate ? String(body.endDate) : null,
      isCurrent: body.isCurrent === true,
      bioSummary: body.bioSummary ? String(body.bioSummary) : null,
      notes: body.notes ? String(body.notes) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      importKey: body.importKey ? String(body.importKey) : null,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to assign coaching staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }
    await deleteCoachingStaffAssignment(assignmentId);
    const { id } = await params;
    const coachingStaff = await enrichCoachingStaff(id);
    return NextResponse.json({ ok: true, coachingStaff });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove coaching staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
