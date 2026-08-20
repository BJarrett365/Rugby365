/**
 * Smoke-test Pollard overview data widgets (Value Timeline / Radar / Rating History).
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/smoke-pollard-widgets.ts
 */
import { getPublicPlayerOverviewV2 } from "../apps/web/src/lib/public-player-overview-v2-service";

async function main() {
  const o = await getPublicPlayerOverviewV2("handre-pollard-og9nmd6l", { preview: true });
  if (!o) {
    console.error("NULL overview");
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        valueTimeline: {
          snapshotCount: o.valueTimeline.summary.snapshotCount,
          current: o.valueTimeline.summary.currentGbp,
          highest: o.valueTimeline.summary.highestGbp,
          lowest: o.valueTimeline.summary.lowestGbp,
          avgGrowth: o.valueTimeline.summary.avgGrowthLabel,
          trend: o.valueTimeline.summary.trend,
          empty: o.valueTimeline.summary.emptyState,
          displayPoints: o.valueTimeline.displayPoints.length,
          marketCard: o.playerValue?.marketValueGbp ?? null,
          timeline24mLast: o.marketValueTimeline24m.points.at(-1)?.marketValueGbp ?? null,
        },
        radar: {
          periods: o.performanceRadarPeriods.map((p) => ({
            id: p.id,
            label: p.label,
            valid: p.metrics.filter((m) => m.score != null).length,
            scores: Object.fromEntries(p.metrics.map((m) => [m.key, m.score])),
            peer: p.peerLabel,
          })),
          intelligence: {
            attack: o.intelligence.attack,
            playmaking: o.intelligence.playmaking,
            kicking: o.intelligence.kicking,
            gameManagement: o.intelligence.gameManagement,
            defence: o.intelligence.defence,
            physical: o.intelligence.physical,
          },
        },
        ratingHistory: {
          rawRows: o.ratingHistory.length,
          overallSeries: o.ratingHistoryOverall.series.length,
          summary: o.ratingHistoryOverall.summary,
        },
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
