/**
 * Refresh historical RWC player stats from every available structured source,
 * then fill remaining advanced gaps with the labelled AI estimator.
 *
 * Order matters:
 *   1) rugbydatabase lineups
 *   2) match scoring events → fixture_players
 *   3) fixture_players → performance rows
 *   4) Opta published leaders (when present)
 *   5) AI advanced estimates (metres/tackles/etc.) — skip with --skip-estimate
 *   6) Wikipedia confirmed try/points leaders last (selective, no double-count)
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-historical-player-stats.ts --years=1991
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-historical-player-stats.ts --years=2023 --skip-estimate
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const yearsArg = args.find((a) => a.startsWith("--years=")) ?? "--years=1987,1991";
const skipEstimate = args.includes("--skip-estimate");

function run(script: string, extra: string[] = []) {
  const cmd = ["tsx", "--require", "./scripts/stub-server-only.cjs", script, yearsArg, ...extra];
  console.log(`\n▶ ${cmd.join(" ")}`);
  const result = spawnSync("npx", cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
  if (result.status !== 0) {
    throw new Error(`${script} failed with status ${result.status ?? "unknown"}`);
  }
}

function main() {
  console.log(`Backfilling RWC historical player stats (${yearsArg}${skipEstimate ? ", skip-estimate" : ""})`);
  run("scripts/import-rugbydatabase-rwc.ts");
  run("scripts/apply-rwc-scoring-events-to-stats.ts");
  run("scripts/sync-rwc-fixture-player-performance.ts");
  run("scripts/import-rwc-opta-leaderboards.ts");
  if (skipEstimate) {
    console.log("\n▶ skip estimate-rwc-historical-player-stats.ts (--skip-estimate)");
  } else {
    run("scripts/estimate-rwc-historical-player-stats.ts");
  }
  run("scripts/import-wikipedia-rwc-statistics.ts");
  console.log(
    skipEstimate
      ? "\nDone. Confirmed scoring from events/Wikipedia/SDMS; estimates skipped."
      : "\nDone. Confirmed scoring from events/Wikipedia; advanced gaps labelled as estimates.",
  );
}

main();
