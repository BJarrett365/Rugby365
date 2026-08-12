import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { recalculateCoach } from "@/lib/coach-recalc-service";
import { processRecalcQueue } from "@/lib/data-change-event-service";

/**
 * Nightly reconciliation:
 * - drain entity_recalc_queue (players/teams/coaches/referees)
 * - also drain legacy coach calc_status stale/partial/failed
 *
 * Auth: Authorization: Bearer $CRON_SECRET (or x-cron-secret).
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return bearer === secret || headerSecret === secret;
}

export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30));

    const queueResult = await processRecalcQueue({ limit });

    const db = getDb();
    let legacyCoachIds: string[] = [];
    try {
      const rows = await db
        .select({ id: coaches.id })
        .from(coaches)
        .where(
          or(
            eq(coaches.calcStatus, "stale"),
            eq(coaches.calcStatus, "partial"),
            eq(coaches.calcStatus, "failed"),
          ),
        )
        .limit(Math.min(20, limit));
      legacyCoachIds = rows.map((r) => r.id);
    } catch {
      const rows = await db.execute(sql`
        select id from coaches
        where coalesce(calc_status, 'current') in ('stale', 'partial', 'failed')
        limit ${Math.min(20, limit)}
      `);
      legacyCoachIds = ((rows as unknown as { rows?: Array<{ id: string }> }).rows ?? []).map(
        (r) => r.id,
      );
    }

    // Skip coaches already processed in queue this run
    const processedCoaches = new Set(
      queueResult.results.filter((r) => r.entityType === "coach").map((r) => r.entityId),
    );
    const legacyResults: Array<{ coachId: string; status: string; error?: string }> = [];
    for (const id of legacyCoachIds) {
      if (processedCoaches.has(id)) continue;
      const result = await recalculateCoach(id, {
        refreshLinks: true,
        persistRatings: true,
        overwriteLinks: true,
      });
      legacyResults.push({
        coachId: id,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
      });
    }

    return NextResponse.json({
      ok: true,
      queue: queueResult,
      legacyCoaches: { processed: legacyResults.length, results: legacyResults },
      at: new Date().toISOString(),
    });
  } catch (e) {
    return apiErrorResponse(e, "Coach reconciliation failed");
  }
}

export const POST = GET;
