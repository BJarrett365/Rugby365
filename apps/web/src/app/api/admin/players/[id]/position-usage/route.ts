import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  players,
} from "@rugby365/db";
import { getDb } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  computePlayerPositionUsage,
  type PositionAppearanceInput,
} from "@/lib/player-position-usage-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
    if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fixturePlayerRows = await db
      .select()
      .from(fixturePlayers)
      .where(eq(fixturePlayers.playerId, id));

    const fixtureIds = [...new Set(fixturePlayerRows.map((r) => r.fixtureId))];
    const [perfRows, ratingRows, kickoffRows] = fixtureIds.length
      ? await Promise.all([
          db
            .select({
              fixtureId: playerMatchPerformanceStats.fixtureId,
              minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
            })
            .from(playerMatchPerformanceStats)
            .where(
              and(
                eq(playerMatchPerformanceStats.playerId, id),
                inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
              ),
            ),
          db
            .select({
              fixtureId: playerMatchRatings.fixtureId,
              minutesPlayed: playerMatchRatings.minutesPlayed,
              rating: playerMatchRatings.rating,
            })
            .from(playerMatchRatings)
            .where(
              and(
                eq(playerMatchRatings.playerId, id),
                inArray(playerMatchRatings.fixtureId, fixtureIds),
              ),
            ),
          db
            .select({ id: fixtures.id, kickoffAt: fixtures.kickoffAt })
            .from(fixtures)
            .where(inArray(fixtures.id, fixtureIds)),
        ])
      : [[], [], []];

    const minutesByFixture = new Map<string, number>();
    for (const r of perfRows) {
      if (r.minutesPlayed > 0) minutesByFixture.set(r.fixtureId, r.minutesPlayed);
    }
    for (const r of ratingRows) {
      if (!minutesByFixture.has(r.fixtureId) && r.minutesPlayed > 0) {
        minutesByFixture.set(r.fixtureId, r.minutesPlayed);
      }
    }
    const ratingByFixture = new Map(
      ratingRows.filter((r) => r.rating != null).map((r) => [r.fixtureId, r.rating as number]),
    );
    const kickoffByFixture = new Map(
      kickoffRows.map((r) => [r.id, r.kickoffAt ? r.kickoffAt.toISOString() : null]),
    );

    const internationalTeamId = player.internationalTeamId;
    const rows: PositionAppearanceInput[] = fixturePlayerRows.map((r) => ({
      positionName: r.positionName,
      jerseyNumber: r.jerseyNumber,
      squadRole: r.squadRole,
      scope: internationalTeamId && r.teamId === internationalTeamId ? "international" : "club",
      minutesPlayed: minutesByFixture.get(r.fixtureId) ?? null,
      matchRating: ratingByFixture.get(r.fixtureId) ?? null,
      kickoffAt: kickoffByFixture.get(r.fixtureId) ?? null,
    }));

    const usage = computePlayerPositionUsage({
      playerId: id,
      displayName: player.knownAs || player.fullName || player.slug,
      slug: player.slug,
      rows,
      verifiedCareerApps: player.verifiedInternationalCaps,
    });

    const secondary =
      Array.isArray(player.positions) && player.positions.length
        ? (player.positions as unknown[])
            .map((p) => (typeof p === "string" ? p : null))
            .filter((p): p is string => Boolean(p))
            .filter((p) => p.toLowerCase() !== (player.positionName ?? "").toLowerCase())
        : [];

    return NextResponse.json({
      usage,
      currentPrimary: player.positionName,
      secondaryPositions: secondary,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load position usage");
  }
}
