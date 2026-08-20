import { getPlayerStats } from "../apps/web/src/lib/public-player-stats-v2-service";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

async function main() {
  const stats = await getPlayerStats(PLAYER_ID, {});
  if (!stats) {
    console.log("NO STATS");
    process.exit(1);
  }

  const log = stats.career.gameLog;
  console.log("=== SEASONS ===");
  console.log(JSON.stringify(stats.availableSeasons, null, 2));
  console.log("=== COVERAGE ===");
  console.log(JSON.stringify(stats.coverage, null, 2));
  console.log("=== GAME LOG COUNT ===", log.length);

  const bySeason: Record<string, number> = {};
  for (const r of log) {
    const s = r.seasonSlug ?? "unknown";
    bySeason[s] = (bySeason[s] ?? 0) + 1;
  }
  console.log("=== BY SEASON ===", JSON.stringify(bySeason));

  const fixtureIds = log.map((r) => r.fixtureId);
  const dupes = fixtureIds.filter((id, i) => fixtureIds.indexOf(id) !== i);
  console.log("=== DUPLICATE FIXTURE IDS ===", [...new Set(dupes)]);

  console.log("=== LATEST 5 ===");
  for (const r of log.slice(0, 5)) {
    console.log(
      [
        r.kickoffAt?.slice(0, 10),
        r.teamName,
        r.competitionName,
        r.opponentName,
        r.result,
        `${r.scoreFor}-${r.scoreAgainst}`,
        `min=${r.minutes}`,
        `pts=${r.points}`,
        `conv=${r.conversions}/${r.conversionAttempts}`,
        `rating=${r.rating}`,
        `band=${r.ratingBand}`,
      ].join(" | "),
    );
  }

  const withBreakdown = log.filter((r) => r.ratingBreakdown != null).length;
  console.log("ratingBreakdown rows", withBreakdown);

  console.log(
    "rated",
    log.filter((r) => r.rating != null).length,
    "minutes",
    log.filter((r) => r.minutes != null).length,
    "withHref",
    log.filter((r) => r.href).length,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
