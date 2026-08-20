import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { backfillCoachData } from "@/lib/coach-recalc-service";

/**
 * POST /api/admin/coaches/backfill
 * Body: { mode: 'coach'|'team'|'all_active'|'all', coachId?, teamId? }
 * Recomputes from existing Rugby365 data — does not invent facts.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      mode?: string;
      coachId?: string;
      teamId?: string;
    };
    const mode = (body.mode ?? "coach") as "coach" | "team" | "all_active" | "all";
    if (mode === "coach" && !body.coachId) {
      return NextResponse.json({ error: "coachId required for mode=coach" }, { status: 400 });
    }
    if (mode === "team" && !body.teamId) {
      return NextResponse.json({ error: "teamId required for mode=team" }, { status: 400 });
    }
    const result = await backfillCoachData({
      mode,
      coachId: body.coachId,
      teamId: body.teamId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Coach backfill failed");
  }
}
