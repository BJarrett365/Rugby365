import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { playerRatings, players } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { invalidateRadarCachesForPlayer, parseRadarSettings } from "@/lib/player-radar-service";

type Body = {
  settings?: {
    enabled?: boolean;
    defaultType?: string;
    minMinutes?: number;
  };
  summaryOverride?: string | null;
  summaryApproved?: boolean;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const [row] = await db
    .select({
      settings: playerRatings.radarSettings,
      summaryOverride: playerRatings.radarSummaryOverride,
      summaryApproved: playerRatings.radarSummaryApproved,
    })
    .from(playerRatings)
    .where(eq(playerRatings.playerId, id))
    .limit(1);
  return NextResponse.json({
    settings: parseRadarSettings(row?.settings),
    summaryOverride: row?.summaryOverride ?? null,
    summaryApproved: Boolean(row?.summaryApproved),
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

  const settings = parseRadarSettings(body.settings);
  const summaryOverride = body.summaryOverride?.trim() || null;
  const summaryApproved = body.summaryApproved === true;

  const [existing] = await db
    .select({ playerId: playerRatings.playerId })
    .from(playerRatings)
    .where(eq(playerRatings.playerId, id))
    .limit(1);

  if (existing) {
    await db
      .update(playerRatings)
      .set({
        radarSettings: settings,
        radarSummaryOverride: summaryOverride,
        radarSummaryApproved: summaryApproved,
        updatedAt: new Date(),
      })
      .where(eq(playerRatings.playerId, id));
  } else {
    await db.insert(playerRatings).values({
      playerId: id,
      radarSettings: settings,
      radarSummaryOverride: summaryOverride,
      radarSummaryApproved: summaryApproved,
      dataPoints: 0,
    });
  }

  await invalidateRadarCachesForPlayer(id);

  return NextResponse.json({ ok: true, settings, summaryOverride, summaryApproved });
}
