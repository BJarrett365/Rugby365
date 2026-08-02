#!/usr/bin/env tsx
/**
 * Rugby Data API bulk import CLI.
 *
 * Usage:
 *   npm run import:rugby-data:discover
 *   npm run import:rugby-data:all
 *   npm run import:rugby-data:enrich
 *   tsx scripts/import-rugby-data-all.ts import-league --id=104
 *   tsx scripts/import-rugby-data-all.ts import-date-range --from=2025-01-01 --to=2026-12-31
 */
import { discoverRugbyDataLeagues } from "../apps/web/src/lib/rugby-data-discovery-service";
import { importAllRugbyDataLeagues, importRugbyDataDateRange, importRugbyDataLeague } from "../apps/web/src/lib/rugby-data-import-service";
import {
  buildRugbyDataImportCoverageReport,
  enrichRugbyDataMatches,
} from "../apps/web/src/lib/rugby-data-match-import-service";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function readNumericArg(name: string): number | undefined {
  const raw = readArg(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function main() {
  const action = process.argv[2] ?? "help";

  if (action === "discover") {
    const result = await discoverRugbyDataLeagues({ startedBy: "cli" });
    console.log(
      JSON.stringify(
        {
          ok: true,
          jobId: result.jobId,
          leagues: result.leagues.length,
          countryCount: result.countryCount,
          newsCount: result.newsCount,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (action === "import-league") {
    const leagueId = readNumericArg("id");
    if (!leagueId) throw new Error("import-league requires --id=<leagueId>");
    const result = await importRugbyDataLeague(leagueId);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  if (action === "import-all-leagues" || action === "import-all") {
    const leagueId = readNumericArg("id");
    const result = await importAllRugbyDataLeagues({
      startedBy: "cli",
      leagueIds: leagueId ? [leagueId] : undefined,
    });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  if (action === "import-date-range") {
    const from = readArg("from");
    const to = readArg("to");
    if (!from || !to) throw new Error("import-date-range requires --from=YYYY-MM-DD --to=YYYY-MM-DD");
    const result = await importRugbyDataDateRange(from, to);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  if (action === "enrich-matches" || action === "enrich") {
    const leagueId = readNumericArg("league");
    const limit = readNumericArg("limit") ?? 500;
    const status = readArg("status") ?? "full_time";
    const result = await enrichRugbyDataMatches({ leagueId, limit, status, startedBy: "cli" });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  if (action === "coverage-report") {
    const report = await buildRugbyDataImportCoverageReport();
    console.log(JSON.stringify({ ok: true, report }, null, 2));
    return;
  }

  console.log(`Rugby Data bulk import

Actions:
  discover
  import-league --id=104
  import-all-leagues [--id=104]
  import-date-range --from=YYYY-MM-DD --to=YYYY-MM-DD
  enrich-matches [--league=104] [--limit=500] [--status=full_time]
  coverage-report
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
