/**
 * Rebuild position-percentile radar caches for a season.
 *
 * Usage:
 *   npx tsx scripts/rebuild-player-radar-caches.ts --season=2025-26
 *   npx tsx scripts/rebuild-player-radar-caches.ts --season-id=<uuid> --limit=200
 */
import {
  createDb,
  competitionSeasons,
  competitions,
  playerRadarCaches,
  playerRatings,
  players,
  playerSeasonStats,
} from "@rugby365/db";
import { eq } from "drizzle-orm";
import { seasonLabelToPublicSlug } from "../apps/web/src/lib/public-player-filters";
import { buildPlayerRadarBundle } from "../apps/web/src/lib/player-radar-build";
import { normalizePositionFamily } from "../apps/web/src/lib/player-radar-positions";

async function main() {
  const args = process.argv.slice(2);
  const seasonArg = args.find((a) => a.startsWith("--season="))?.slice("--season=".length);
  const seasonIdArg = args.find((a) => a.startsWith("--season-id="))?.slice("--season-id=".length);
  const limit = Number(
    args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length) ?? "500",
  );

  const db = createDb();

  let seasonId = seasonIdArg ?? null;
  if (!seasonId && seasonArg) {
    const rows = await db.select().from(competitionSeasons);
    const match = rows.find((r) => {
      const slug = (r.slug ?? "").toLowerCase();
      const fromLabel = seasonLabelToPublicSlug(r.label)?.toLowerCase();
      return slug === seasonArg.toLowerCase() || fromLabel === seasonArg.toLowerCase();
    });
    seasonId = match?.id ?? null;
  }

  if (!seasonId) {
    const [withStats] = await db
      .select({ seasonId: playerSeasonStats.seasonId })
      .from(playerSeasonStats)
      .limit(1);
    seasonId = withStats?.seasonId ?? null;
  }

  if (!seasonId) {
    console.error("No season found.");
    process.exit(1);
  }

  await db.delete(playerRadarCaches).where(eq(playerRadarCaches.seasonId, seasonId));

  const rows = await db
    .select({
      playerId: playerSeasonStats.playerId,
      name: players.name,
      positionName: players.positionName,
      competitionId: playerSeasonStats.competitionId,
      minutesPlayed: playerSeasonStats.minutesPlayed,
      appearances: playerSeasonStats.appearances,
      tries: playerSeasonStats.tries,
      points: playerSeasonStats.points,
      carries: playerSeasonStats.carries,
      metresCarried: playerSeasonStats.metresCarried,
      tacklesMade: playerSeasonStats.tacklesMade,
      tacklesCompleted: playerSeasonStats.tacklesCompleted,
      dominantTackles: playerSeasonStats.dominantTackles,
      turnoversWon: playerSeasonStats.turnoversWon,
      tryAssists: playerSeasonStats.tryAssists,
      lineBreaks: playerSeasonStats.lineBreaks,
      defendersBeaten: playerSeasonStats.defendersBeaten,
      touches: playerSeasonStats.touches,
      postContactMetres: playerSeasonStats.postContactMetres,
      ruckArrivalEffectiveness: playerSeasonStats.ruckArrivalEffectiveness,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .where(eq(playerSeasonStats.seasonId, seasonId));

  const [season] = await db
    .select({
      label: competitionSeasons.label,
      competitionId: competitionSeasons.competitionId,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, seasonId))
    .limit(1);

  const [comp] = season
    ? await db
        .select({ name: competitions.name })
        .from(competitions)
        .where(eq(competitions.id, season.competitionId))
        .limit(1)
    : [null];

  const byPlayer = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }

  const minMinutes = 400;
  const peers = rows
    .filter((r) => r.minutesPlayed >= minMinutes)
    .map((r) => ({
      playerId: r.playerId,
      positionName: r.positionName,
      competitionId: r.competitionId,
      minutesPlayed: r.minutesPlayed,
      appearances: r.appearances,
      tries: r.tries,
      points: r.points,
      carries: r.carries,
      metresCarried: r.metresCarried,
      tacklesMade: r.tacklesMade,
      tacklesCompleted: r.tacklesCompleted,
      dominantTackles: r.dominantTackles,
      turnoversWon: r.turnoversWon,
      tryAssists: r.tryAssists,
      lineBreaks: r.lineBreaks,
      defendersBeaten: r.defendersBeaten,
      touches: r.touches,
      postContactMetres: r.postContactMetres,
      ruckArrivalEffectiveness: r.ruckArrivalEffectiveness,
    }));

  let built = 0;
  for (const [playerId, playerRows] of byPlayer) {
    if (built >= limit) break;
    const first = playerRows[0]!;
    const [rating] = await db
      .select({
        radarSettings: playerRatings.radarSettings,
        radarSummaryOverride: playerRatings.radarSummaryOverride,
        radarSummaryApproved: playerRatings.radarSummaryApproved,
      })
      .from(playerRatings)
      .where(eq(playerRatings.playerId, playerId))
      .limit(1);

    const settings =
      rating?.radarSettings && typeof rating.radarSettings === "object"
        ? (rating.radarSettings as {
            enabled?: boolean;
            defaultType?: string;
            minMinutes?: number;
          })
        : {};
    if (settings.enabled === false) continue;

    const bundle = buildPlayerRadarBundle({
      playerId,
      playerName: first.name,
      positionName: first.positionName,
      competitionLabel: comp?.name ?? null,
      seasonLabel: season?.label ?? null,
      minMinutes: typeof settings.minMinutes === "number" ? settings.minMinutes : minMinutes,
      defaultType: (settings.defaultType as "overall") || "overall",
      enabled: true,
      summaryOverride: rating?.radarSummaryOverride ?? null,
      summaryApproved: Boolean(rating?.radarSummaryApproved),
      playerRows: playerRows.map((r) => ({
        minutesPlayed: r.minutesPlayed,
        appearances: r.appearances,
        tries: r.tries,
        points: r.points,
        carries: r.carries,
        metresCarried: r.metresCarried,
        tacklesMade: r.tacklesMade,
        tacklesCompleted: r.tacklesCompleted,
        dominantTackles: r.dominantTackles,
        turnoversWon: r.turnoversWon,
        tryAssists: r.tryAssists,
        lineBreaks: r.lineBreaks,
        defendersBeaten: r.defendersBeaten,
        touches: r.touches,
        postContactMetres: r.postContactMetres,
        ruckArrivalEffectiveness: r.ruckArrivalEffectiveness,
      })),
      peers,
    });

    await db.insert(playerRadarCaches).values({
      playerId,
      seasonId,
      competitionId: first.competitionId,
      teamId: null,
      scope: "domestic",
      positionFamily: normalizePositionFamily(first.positionName),
      minMinutes: bundle.minMinutes,
      title: bundle.title,
      cohortSize: bundle.cohortSize,
      payload: bundle,
      computedAt: new Date(),
    });
    built += 1;
  }

  console.log(
    JSON.stringify(
      {
        seasonId,
        seasonLabel: season?.label,
        competition: comp?.name,
        playersWithStats: byPlayer.size,
        cachesBuilt: built,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
