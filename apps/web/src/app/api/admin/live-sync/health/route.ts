import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { isSdmsExternalMatchId } from "@/lib/fixture-live-score-sync";

/**
 * Lightweight live-sync health for ops.
 * Shows how many CMS fixtures look live / need SDMS catch-up right now.
 * Does not call providers — safe to poll.
 */
export async function GET() {
  try {
    const db = getDb();
    const now = Date.now();
    const windowStart = new Date(now - 6 * 60 * 60_000);
    const windowEnd = new Date(now + 45 * 60_000);

    const liveRows = await db
      .select({
        id: fixtures.id,
        status: fixtures.status,
        externalMatchId: fixtures.externalMatchId,
        kickoffAt: fixtures.kickoffAt,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(fixtures)
      .where(
        inArray(fixtures.status, ["live", "half_time", "first_half", "second_half", "in_progress"]),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(40);

    const windowScheduled = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fixtures)
      .where(
        and(
          eq(fixtures.status, "scheduled"),
          isNotNull(fixtures.kickoffAt),
          gte(fixtures.kickoffAt, windowStart),
          sql`${fixtures.kickoffAt} < ${windowEnd}`,
        ),
      );

    const liveWithSdms = liveRows.filter((row) => isSdmsExternalMatchId(row.externalMatchId));
    const liveMissingSdms = liveRows.length - liveWithSdms.length;

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      liveCount: liveRows.length,
      liveWithSdmsId: liveWithSdms.length,
      liveMissingSdmsId: liveMissingSdms,
      kickoffWindowScheduled: Number(windowScheduled[0]?.n ?? 0),
      liveSample: liveWithSdms.slice(0, 8).map((row) => ({
        id: row.id,
        status: row.status,
        score: `${row.homeScore ?? 0}-${row.awayScore ?? 0}`,
        kickoffAt: row.kickoffAt?.toISOString() ?? null,
        externalMatchId: row.externalMatchId,
      })),
      hints: [
        "Cron: POST /api/cron/live-scores (Netlify scheduled every 2m via live-scores-cron).",
        "If liveCount stays >0 but scores freeze, check Netlify scheduled function logs and CRON_SECRET.",
      ],
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load live sync health");
  }
}

export const dynamic = "force-dynamic";
