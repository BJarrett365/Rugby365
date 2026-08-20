/**
 * Pollard DEFENSIVE STATS audit — real data only (no mock 91/68/7/12/12).
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/audit-pollard-defence.ts
 */
import { getDb } from "../apps/web/src/lib/db";
import { sql } from "drizzle-orm";
import { getPlayerStats } from "../apps/web/src/lib/public-player-stats-v2-service";
import {
  defenceMatchesGameLog,
  filterGameLogBySeason,
} from "../apps/web/src/lib/public-player-stats-v2-math";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

function reportDefence(
  label: string,
  defence: NonNullable<Awaited<ReturnType<typeof getPlayerStats>>>["season"]["defence"],
  matches: number,
) {
  const attempts =
    defence.attempts != null
      ? defence.attempts
      : defence.tacklesMade != null && defence.missedTackles != null
        ? defence.tacklesMade + defence.missedTackles
        : null;
  console.log(`\n--- ${label} (${matches} appearances) ---`);
  console.log(
    [
      `Tackle Success %: ${defence.tackleSuccessPct ?? "—"}  (SUM made / (made+missed); never avg of match %)`,
      `Tackles Made:     ${defence.tacklesMade ?? "—"}  [source: player_match_performance_stats.tackles_completed]`,
      `Missed Tackles:   ${defence.missedTackles ?? "—"}  [source: extras.missedTackles]`,
      `Dominant Tackles: ${defence.dominantTackles ?? "—"}  [source: dominant_tackles; provider only]`,
      `Turnovers Won:    ${defence.turnoversWon ?? "—"}  [source: turnovers_won; player]`,
      `Attempts:         ${attempts ?? "—"}  (paired made+missed only)`,
      `Coverage:         ${defence.matchesWithTackleSample}/${defence.matchesInScope} paired (${defence.coveragePct ?? "—"}%)`,
      `Perf rows:        ${defence.matchesWithPerf}`,
      `metricCoverage:   ${JSON.stringify(defence.metricCoverage)}`,
      `limitedSample:    ${defence.limitedSample}`,
      `message:          ${defence.message ?? "—"}`,
    ].join("\n"),
  );
}

async function main() {
  const db = getDb();

  const extrasKeys = await db.execute(sql`
    SELECT DISTINCT jsonb_object_keys(extras) AS key
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
    ORDER BY 1
  `);
  console.log("=== EXTRAS KEYS (defence-relevant) ===");
  const keys = ((extrasKeys as { rows?: Array<{ key: string }> }).rows ?? extrasKeys) as Array<{
    key: string;
  }>;
  console.log(
    keys
      .map((r) => r.key)
      .filter((k) => /tackle|turnover|missed/i.test(k))
      .join(", ") || "(none)",
  );

  const bySeason = await db.execute(sql`
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM f.kickoff_at) >= 7 THEN EXTRACT(YEAR FROM f.kickoff_at)::int
        ELSE EXTRACT(YEAR FROM f.kickoff_at)::int - 1
      END AS season_start,
      COUNT(*)::int AS perf_matches,
      COALESCE(SUM(pmps.tackles_made),0)::int AS tackles_made_col,
      COALESCE(SUM(pmps.tackles_completed),0)::int AS tackles_completed,
      COALESCE(SUM(pmps.dominant_tackles),0)::int AS dominant_tackles,
      COALESCE(SUM(pmps.turnovers_won),0)::int AS turnovers_won,
      COUNT(*) FILTER (
        WHERE pmps.extras ? 'missedTackles' OR pmps.extras ? 'missed_tackles'
      )::int AS matches_with_missed_key,
      COALESCE(
        SUM(
          COALESCE(
            (pmps.extras->>'missedTackles')::numeric,
            (pmps.extras->>'missed_tackles')::numeric
          )
        ),
        0
      )::int AS missed_sum_when_present
    FROM player_match_performance_stats pmps
    JOIN fixtures f ON f.id = pmps.fixture_id
    WHERE pmps.player_id = ${PLAYER_ID}
      AND f.kickoff_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
  `);
  console.log("\n=== RAW PERF BY SEASON (note: tackles_made_col ≈ completed+missed attempts) ===");
  console.log(JSON.stringify((bySeason as { rows?: unknown }).rows ?? bySeason, null, 2));

  const madeVsCompleted = await db.execute(sql`
    SELECT
      COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE tackles_made = tackles_completed)::int AS equal,
      COUNT(*) FILTER (WHERE tackles_made = tackles_completed + COALESCE((extras->>'missedTackles')::int, (extras->>'missed_tackles')::int, 0))::int AS made_eq_completed_plus_missed,
      AVG(tackles_made)::numeric(10,2) AS avg_made_col,
      AVG(tackles_completed)::numeric(10,2) AS avg_completed
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
  `);
  console.log("\n=== MADE COL VS COMPLETED ===");
  console.log(JSON.stringify((madeVsCompleted as { rows?: unknown }).rows ?? madeVsCompleted, null, 2));

  const dto = await getPlayerStats(PLAYER_ID, {});
  if (!dto) {
    console.log("DTO null");
    return;
  }

  console.log("\n=== DEFAULT SEASON (shared Stats filter) ===");
  console.log(`selectedSeasonSlug: ${dto.selectedSeasonSlug} (${dto.selectedSeasonLabel})`);
  reportDefence("Season defence", dto.season.defence, dto.season.matches);
  reportDefence("Career defence", dto.career.defence, dto.career.matches);

  const season2024 = await getPlayerStats(PLAYER_ID, { season: "2024-25" });
  if (season2024) {
    reportDefence("Season 2024/25 defence", season2024.season.defence, season2024.season.matches);
  }

  const logFiltered = filterGameLogBySeason(dto.career.gameLog, dto.selectedSeasonSlug);
  const reconciles = defenceMatchesGameLog(dto.season.defence, logFiltered);
  console.log("\n=== GAME LOG RECONCILIATION (same season filter) ===");
  console.log(
    `season ${dto.selectedSeasonSlug}: defenceMatchesGameLog = ${reconciles} (log rows ${logFiltered.length})`,
  );
  console.log(
    "Mock 91%/68/7/12/12 NOT used — real values above are from provider performance rows.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
