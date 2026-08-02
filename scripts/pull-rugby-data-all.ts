#!/usr/bin/env tsx
/**
 * Pull all Rugby Data API feeds into provider_raw_responses and emit ingest gap report.
 *
 * Usage:
 *   npm run pull:rugby-data              # full pull (slow — all leagues + date sweep)
 *   npm run pull:rugby-data -- --league-limit=5 --date-sweep-days=7
 *   npm run pull:rugby-data:report       # gap report only (no API calls)
 */
import fs from "node:fs";
import path from "node:path";
import { pullAllRugbyDataFeeds } from "../apps/web/src/lib/rugby-data-feed-pull-service";
import {
  buildRugbyDataIngestGapReport,
  formatIngestGapReportMarkdown,
} from "../apps/web/src/lib/rugby-data-ingest-gap-report";

const REPORT_DIR = path.join(process.cwd(), "docs/rugby-data-api");

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readNumericArg(name: string): number | undefined {
  const raw = readArg(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function writeReport() {
  const report = await buildRugbyDataIngestGapReport();
  const jsonPath = path.join(REPORT_DIR, "INGEST_GAP_REPORT.json");
  const mdPath = path.join(REPORT_DIR, "INGEST_GAP_REPORT.md");
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, formatIngestGapReportMarkdown(report));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  return report;
}

async function main() {
  const action = process.argv[2] ?? "pull";

  if (action === "report") {
    await writeReport();
    return;
  }

  if (action === "pull" || action === "pull-all") {
    const leagueLimit = readNumericArg("league-limit");
    const dateSweepDays = readNumericArg("date-sweep-days");
    const matchLimitPerLeague = readNumericArg("match-limit-per-league");
    const teamLimit = readNumericArg("team-limit");

    console.log("Starting Rugby Data feed pull (raw capture to provider_raw_responses)…");
    if (leagueLimit) console.log(`  league-limit=${leagueLimit}`);
    if (dateSweepDays != null) console.log(`  date-sweep-days=${dateSweepDays}`);
    if (matchLimitPerLeague) console.log(`  match-limit-per-league=${matchLimitPerLeague}`);

    const result = await pullAllRugbyDataFeeds({
      startedBy: "cli",
      leagueLimit,
      dateSweepDays,
      matchLimitPerLeague,
      teamLimit,
      includeMatchFeeds: !hasFlag("skip-match-feeds"),
      includeTeamFeeds: !hasFlag("skip-team-feeds"),
      includeGlobalFeeds: !hasFlag("skip-global-feeds"),
    });

    console.log(JSON.stringify(result, null, 2));

    const report = await writeReport();
    console.log(
      `\nIngest gap summary: ${report.notIngested.endpoints.length} endpoints and ${report.notIngested.fields.length} field groups not fully ingested (see INGEST_GAP_REPORT.md)`,
    );
    return;
  }

  console.log(`Rugby Data feed pull

Actions:
  pull [--league-limit=N] [--date-sweep-days=N] [--match-limit-per-league=N] [--team-limit=N]
       [--skip-match-feeds] [--skip-team-feeds] [--skip-global-feeds]
  report   Generate ingest gap report from catalog + DB counts (no API calls)
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
