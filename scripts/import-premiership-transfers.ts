/**
 * Bulk import Premiership transfer windows from Wikipedia.
 *
 * Usage:
 *   npx tsx scripts/import-premiership-transfers.ts
 *   npx tsx scripts/import-premiership-transfers.ts --season=2016–17
 *   npx tsx scripts/import-premiership-transfers.ts --dry-run
 *   npx tsx scripts/import-premiership-transfers.ts --from=2013
 */
import {
  importPremiershipTransfers,
} from "../apps/web/src/lib/premiership-transfers-import-service";
import {
  PREMIERSHIP_TRANSFER_SOURCES,
  premiershipTransferWikiUrl,
} from "../apps/web/src/lib/premiership-transfer-constants";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlySeason = args.find((a) => a.startsWith("--season="))?.split("=")[1];
const fromYear = Number.parseInt(
  args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "0",
  10,
);
const toYear = Number.parseInt(
  args.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "0",
  10,
);

function seasonStartYear(label: string): number {
  const match = label.match(/^(\d{4})/);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

async function main() {
  const seasons = PREMIERSHIP_TRANSFER_SOURCES.filter((source) => {
    const year = seasonStartYear(source.seasonLabel);
    if (onlySeason) return source.seasonLabel === onlySeason;
    if (fromYear > 0 && year < fromYear) return false;
    if (toYear > 0 && year > toYear) return false;
    if (fromYear > 0 || toYear > 0) return true;
    return true;
  }).sort((a, b) => seasonStartYear(a.seasonLabel) - seasonStartYear(b.seasonLabel));

  if (!seasons.length) {
    console.error("No seasons matched.");
    process.exit(1);
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Importing ${seasons.length} Premiership transfer window(s) from Wikipedia…\n`,
  );

  const summary: Array<{
    season: string;
    added: number;
    updated: number;
    newPlayers: number;
    linked: number;
    pending: number;
    warnings: number;
    errors: number;
  }> = [];

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 2000));
    const url = season.url ?? premiershipTransferWikiUrl(season.seasonLabel);
    console.log(`→ ${season.seasonLabel}`);
    console.log(`  ${url}`);
    try {
      const started = Date.now();
      const result = await importPremiershipTransfers({
        url,
        seasonLabel: season.seasonLabel,
        dryRun,
      });
      const s = result.summary;
      console.log(
        `  ✓ +${s.transfersAdded} added, ${s.transfersUpdated} updated, ${s.newPlayers} new players, ${s.existingPlayersLinked} linked, ${s.pendingPlayerMatches.length} pending, ${s.warnings.length} warnings, ${s.errors.length} errors (${Math.round((Date.now() - started) / 1000)}s)`,
      );
      if (s.errors.length) {
        for (const err of s.errors.slice(0, 3)) console.log(`  ! ${err}`);
        if (s.errors.length > 3) console.log(`  ! …${s.errors.length - 3} more errors`);
      }
      summary.push({
        season: season.seasonLabel,
        added: s.transfersAdded,
        updated: s.transfersUpdated,
        newPlayers: s.newPlayers,
        linked: s.existingPlayersLinked,
        pending: s.pendingPlayerMatches.length,
        warnings: s.warnings.length,
        errors: s.errors.length,
      });
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
      summary.push({
        season: season.seasonLabel,
        added: 0,
        updated: 0,
        newPlayers: 0,
        linked: 0,
        pending: 0,
        warnings: 0,
        errors: 1,
      });
    }
    console.log("");
  }

  console.log("## Summary");
  console.log("| Season | Added | Updated | New players | Linked | Pending | Warnings | Errors |");
  console.log("| ------ | ----- | ------- | ----------- | ------ | ------- | -------- | ------ |");
  for (const row of summary) {
    console.log(
      `| ${row.season} | ${row.added} | ${row.updated} | ${row.newPlayers} | ${row.linked} | ${row.pending} | ${row.warnings} | ${row.errors} |`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
