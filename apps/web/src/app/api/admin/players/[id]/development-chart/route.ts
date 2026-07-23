import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { playerRatings, players } from "@rugby365/db";
import { getDb } from "@/lib/db";

type Body = {
  settings?: {
    enabled?: boolean;
    showRollingAverage?: boolean;
    showSeasonAverage?: boolean;
    showCareerAverage?: boolean;
    minMinutes?: number;
  };
  summaryOverride?: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const [row] = await db
    .select({
      settings: playerRatings.developmentChartSettings,
      summaryOverride: playerRatings.developmentSummaryOverride,
    })
    .from(playerRatings)
    .where(eq(playerRatings.playerId, id))
    .limit(1);
  return NextResponse.json({
    settings: row?.settings ?? {},
    summaryOverride: row?.summaryOverride ?? null,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb();
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const settings = {
    enabled: body.settings?.enabled !== false,
    showRollingAverage: body.settings?.showRollingAverage !== false,
    showSeasonAverage: body.settings?.showSeasonAverage === true,
    showCareerAverage: body.settings?.showCareerAverage === true,
    minMinutes:
      typeof body.settings?.minMinutes === "number" && body.settings.minMinutes >= 0
        ? body.settings.minMinutes
        : 0,
  };

  const summaryOverride = body.summaryOverride?.trim() || null;
  const [existing] = await db
    .select({ playerId: playerRatings.playerId })
    .from(playerRatings)
    .where(eq(playerRatings.playerId, id))
    .limit(1);

  if (existing) {
    await db
      .update(playerRatings)
      .set({
        developmentChartSettings: settings,
        developmentSummaryOverride: summaryOverride,
        updatedAt: new Date(),
      })
      .where(eq(playerRatings.playerId, id));
  } else {
    await db.insert(playerRatings).values({
      playerId: id,
      developmentChartSettings: settings,
      developmentSummaryOverride: summaryOverride,
      dataPoints: 0,
    });
  }

  return NextResponse.json({ ok: true, settings, summaryOverride });
}
