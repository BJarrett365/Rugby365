import { getPlayerSpatialStats } from "../apps/web/src/lib/public-player-spatial-stats-service";
import { getPlayerStats } from "../apps/web/src/lib/public-player-stats-v2-service";

const ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

async function main() {
  const spatial = await getPlayerSpatialStats(ID, { seasonSlug: "2025-26" });
  const stats = await getPlayerStats(ID, { season: "2025-26" });
  console.log(
    JSON.stringify(
      {
        passing: spatial?.passing,
        kicking: spatial?.kicking,
        statsPassing: stats?.season.passingZones,
        statsKicking: stats?.season.kickingZones,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
