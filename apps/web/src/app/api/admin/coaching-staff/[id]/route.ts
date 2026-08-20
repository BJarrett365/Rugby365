import { NextResponse } from "next/server";
import {
  deleteCoachingStaffAssignment,
  updateCoachingStaffAssignment,
} from "@/lib/coach-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const assignment = await updateCoachingStaffAssignment(id, {
      ...(body.seasonId !== undefined ? { seasonId: body.seasonId ? String(body.seasonId) : null } : {}),
      ...(body.role !== undefined ? { role: String(body.role) } : {}),
      ...(body.careerType !== undefined
        ? { careerType: body.careerType ? String(body.careerType) : null }
        : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate ? String(body.startDate) : null } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate ? String(body.endDate) : null } : {}),
      ...(body.isCurrent !== undefined ? { isCurrent: body.isCurrent === true } : {}),
      ...(body.isPrimaryCoach !== undefined ? { isPrimaryCoach: body.isPrimaryCoach === true } : {}),
      ...(body.showOnOverview !== undefined ? { showOnOverview: body.showOnOverview === true } : {}),
      ...(body.eligibleForCareerRecord !== undefined
        ? { eligibleForCareerRecord: body.eligibleForCareerRecord === true }
        : {}),
      ...(body.overviewLabel !== undefined
        ? { overviewLabel: body.overviewLabel ? String(body.overviewLabel) : null }
        : {}),
      ...(body.teamDisplayName !== undefined
        ? { teamDisplayName: body.teamDisplayName ? String(body.teamDisplayName) : null }
        : {}),
      ...(body.recordStatus !== undefined ? { recordStatus: String(body.recordStatus) } : {}),
      ...(body.bioSummary !== undefined ? { bioSummary: body.bioSummary ? String(body.bioSummary) : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      ...(body.editorNotes !== undefined
        ? { editorNotes: body.editorNotes ? String(body.editorNotes) : null }
        : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null } : {}),
    });
    return NextResponse.json({ assignment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update coaching staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCoachingStaffAssignment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete coaching staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
