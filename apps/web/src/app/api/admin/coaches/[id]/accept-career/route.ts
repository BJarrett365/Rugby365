import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { upsertCoachingStaffAssignment } from "@/lib/coach-admin-service";
import { createCoachPlayingStint } from "@/lib/coach-history-cms-service";
import { resolveCoachStintToCmsTeam } from "@/lib/coach-team-resolve-service";
import { normalizeCoachingRole } from "@/lib/coach-types";

/**
 * Accept a researched career row into CMS as needs_review (never publishes).
 * Body: { kind: 'playing'|'coaching', foundValue: {...}, sourceUrl?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: coachId } = await params;
    const body = (await req.json()) as {
      kind?: string;
      foundValue?: Record<string, unknown>;
      sourceUrl?: string;
    };

    const kind = body.kind;
    const found = body.foundValue ?? {};
    if (kind !== "playing" && kind !== "coaching") {
      return NextResponse.json({ error: "kind must be playing or coaching" }, { status: 400 });
    }

    const teamName = String(found.teamName ?? "").trim();
    if (!teamName) return NextResponse.json({ error: "foundValue.teamName required" }, { status: 400 });

    const team = await resolveCoachStintToCmsTeam(teamName);
    if (!team) {
      return NextResponse.json(
        {
          error: "FLAG TEAM MISSING",
          message: `No Rugby365 team match for “${teamName}”. Link or create the canonical team first.`,
          teamName,
        },
        { status: 409 },
      );
    }

    const sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null;
    const yearsLabel = String(found.yearsLabel ?? "").trim() || "—";

    if (kind === "playing") {
      const startYear =
        typeof found.startYear === "number"
          ? found.startYear
          : Number(String(yearsLabel).match(/\d{4}/)?.[0] ?? "") || null;
      const endYear =
        typeof found.endYear === "number"
          ? found.endYear
          : Number(String(yearsLabel).match(/(\d{4})\s*$/)?.[1] ?? "") || null;
      const careerType = String(found.careerType ?? "provincial");
      const teamType =
        careerType === "international"
          ? "international"
          : careerType === "cup" || careerType === "franchise"
            ? "franchise"
            : "provincial";

      const row = await createCoachPlayingStint(coachId, {
        teamType,
        startYear,
        endYear,
        yearsLabel,
        teamName: team.name,
        teamId: team.id,
        sourceUrl,
        showOnOverview: false,
      });

      const { updateCoachPlayingStint } = await import("@/lib/coach-history-cms-service");
      const updated = await updateCoachPlayingStint(row.id, coachId, {
        recordStatus: "needs_review",
        showOnOverview: false,
      });

      return NextResponse.json({
        ok: true,
        created: "playing",
        row: updated ?? row,
        recordStatus: "needs_review",
        note: "Created as CMS draft/needs review. Verify before Show on Overview / publish.",
      });
    }

    const roleHint = String(found.roleHint ?? found.role ?? "head_coach");
    const role = normalizeCoachingRole(roleHint);
    const startYear =
      typeof found.startYear === "number"
        ? found.startYear
        : Number(String(yearsLabel).match(/\d{4}/)?.[0] ?? "") || null;
    const endYear =
      typeof found.endYear === "number"
        ? found.endYear
        : Number(String(yearsLabel).match(/(\d{4})\s*$/)?.[1] ?? "") || null;

    const startDate = startYear ? `${startYear}-01-01` : null;
    const endDate = endYear ? `${endYear}-12-31` : null;
    const careerType = role.includes("technical")
      ? "technical"
      : role === "director_of_rugby"
        ? "management"
        : "coach";

    const result = await upsertCoachingStaffAssignment({
      coachId,
      teamId: team.id,
      role,
      careerType,
      startDate,
      endDate,
      isCurrent: false,
      showOnOverview: false,
      sourceUrl,
      importKey: `review-accept:${coachId}:${team.id}:${role}:${yearsLabel}`,
      confidence: "medium",
      notes: `Accepted from source review. Original label: ${teamName}${found.roleHint ? ` (${found.roleHint})` : ""}`,
    });

    // Force needs_review status
    const { updateCoachingStaffAssignment } = await import("@/lib/coach-admin-service");
    await updateCoachingStaffAssignment(result.assignment.id, {
      recordStatus: "needs_review",
      showOnOverview: false,
    });

    return NextResponse.json({
      ok: true,
      created: "coaching",
      row: result.assignment,
      createdNew: result.created,
      recordStatus: "needs_review",
      note: "Saved as needs_review. Verify before overview/public publish.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to accept career suggestion");
  }
}
