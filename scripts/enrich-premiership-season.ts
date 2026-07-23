#!/usr/bin/env npx tsx
/**
 * Import and enrich a Premiership season from Planet Rugby / SDMS.
 *
 *   npx tsx scripts/enrich-premiership-season.ts
 *   npx tsx scripts/enrich-premiership-season.ts --season=2025-26
 *   npx tsx scripts/enrich-premiership-season.ts --audit-only
 */
import {
  auditPremiershipSeasonEnrichment,
  importAndEnrichPremiershipSeason,
} from "../apps/web/src/lib/premiership-season-enrich-service";

const args = process.argv.slice(2);
const seasonLabel = args.find((arg) => arg.startsWith("--season="))?.split("=")[1] ?? "2026–27";
const auditOnly = args.includes("--audit-only");

function printAudit(audit: Awaited<ReturnType<typeof auditPremiershipSeasonEnrichment>>) {
  console.log(`\n# ${audit.seasonLabel} enrichment audit`);
  console.log(
    `Fixtures: ${audit.totalFixtures} total · ${audit.completedFixtures} completed · ${audit.fullyEnriched} fully enriched · ${audit.missingEnrichment} gaps`,
  );
  console.log("\n| Round | Fixtures | PR URL | Squads | Events | Complete |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const round of audit.rounds) {
    if (!/^Round\s+\d+$/i.test(round.round) && round.round !== "Final") continue;
    console.log(
      `| ${round.round} | ${round.total} | ${round.withPlanetRugbyUrl} | ${round.withSquads} | ${round.withEvents} | ${round.complete} |`,
    );
  }
  if (audit.gaps.length) {
    console.log(`\nGaps (${audit.gaps.length}):`);
    for (const gap of audit.gaps.slice(0, 20)) {
      console.log(
        `- ${gap.slug} [${gap.round ?? "—"}] squad=${gap.squadCount} events=${gap.eventCount} url=${gap.planetRugbyUrl ? "yes" : "no"}`,
      );
    }
    if (audit.gaps.length > 20) console.log(`… and ${audit.gaps.length - 20} more`);
  }
}

async function main() {
  if (auditOnly) {
    printAudit(await auditPremiershipSeasonEnrichment(seasonLabel));
    return;
  }

  console.log(`Importing and enriching Premiership ${seasonLabel} from Planet Rugby…`);
  const result = await importAndEnrichPremiershipSeason(seasonLabel, {
    onProgress: (message) => console.log(message),
  });

  if ("created" in result.importResult) {
    const row = result.importResult;
    console.log(
      `\nImport: +${row.created} created · ${row.updated} updated · ${row.skipped ?? 0} skipped · ${row.matchDetailsEnriched ?? 0} enriched · ${row.matchDetailsFailed ?? 0} failed`,
    );
  }

  console.log(
    `Alias cleanup: removed ${result.aliasCleanup.removed} duplicate fixtures (kept ${result.aliasCleanup.kept} canonical groups)`,
  );
  console.log(
    `Gap fill: enriched ${result.gapFill.enriched} · failed ${result.gapFill.failed} · skipped ${result.gapFill.skipped}`,
  );

  printAudit(result.audit);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
