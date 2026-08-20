import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getDb } from "@/lib/db";
import { coaches, teamCoachingStaff, coachPlayingStints, coachHonours } from "@rugby365/db";
import { sql, asc } from "drizzle-orm";

export type CoachAttentionReason =
  | "Missing Current Team"
  | "Missing Career"
  | "Missing Image"
  | "Missing Honours"
  | "Missing Source"
  | "Needs Review"
  | "Missing Crest";

/**
 * Coaches needing attention — editorial working queue.
 * GET /api/admin/coaches/attention
 */
export async function GET() {
  try {
    const db = getDb();
    const coachRows = await db.select().from(coaches).orderBy(asc(coaches.name));

    const assignmentAgg = await db
      .select({
        coachId: teamCoachingStaff.coachId,
        total: sql<number>`count(*)::int`,
        current: sql<number>`count(*) filter (where ${teamCoachingStaff.isCurrent} = true)::int`,
        needsReview: sql<number>`count(*) filter (where ${teamCoachingStaff.recordStatus} = 'needs_review')::int`,
      })
      .from(teamCoachingStaff)
      .groupBy(teamCoachingStaff.coachId);

    const playingAgg = await db
      .select({
        coachId: coachPlayingStints.coachId,
        total: sql<number>`count(*)::int`,
      })
      .from(coachPlayingStints)
      .groupBy(coachPlayingStints.coachId);

    const honourAgg = await db
      .select({
        coachId: coachHonours.coachId,
        total: sql<number>`count(*)::int`,
      })
      .from(coachHonours)
      .groupBy(coachHonours.coachId);

    const byAssign = new Map(assignmentAgg.map((r) => [r.coachId, r]));
    const byPlaying = new Map(playingAgg.map((r) => [r.coachId, r]));
    const byHonour = new Map(honourAgg.map((r) => [r.coachId, r]));

    const queue = coachRows
      .map((c) => {
        const a = byAssign.get(c.id);
        const p = byPlaying.get(c.id);
        const h = byHonour.get(c.id);
        const reasons: CoachAttentionReason[] = [];
        if (!a || a.current === 0) reasons.push("Missing Current Team");
        if ((!a || a.total === 0) && (!p || p.total === 0)) reasons.push("Missing Career");
        if (!c.imageUrl?.trim()) reasons.push("Missing Image");
        if (!h || h.total === 0) reasons.push("Missing Honours");
        if (!c.wikipediaUrl?.trim() && !c.sourceUrl?.trim()) reasons.push("Missing Source");
        if (a && a.needsReview > 0) reasons.push("Needs Review");
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          reasons,
        };
      })
      .filter((row) => row.reasons.length > 0);

    return NextResponse.json({
      ok: true,
      count: queue.length,
      coaches: queue,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load attention queue");
  }
}
