#!/usr/bin/env npx tsx
/**
 * CLI wrapper for data health audit (competition + season scoping).
 * Usage: npx tsx scripts/data-health-audit.ts [--json]
 */
import { runDataHealthAudit } from "../apps/web/src/lib/data-audit-service";

async function main() {
  const json = process.argv.includes("--json");
  const report = await runDataHealthAudit();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Data health audit — ${report.generatedAt}`);
  console.log(`Errors: ${report.summary.errors}  Warnings: ${report.summary.warnings}  Info: ${report.summary.info}\n`);

  for (const section of Object.values(report.sections)) {
    console.log(`## ${section.label}`);
    console.log(`Counts: ${JSON.stringify(section.recordCounts)}`);
    for (const finding of section.errors) console.log(`  ERROR: ${finding.message}`);
    for (const finding of section.warnings) console.log(`  WARN:  ${finding.message}`);
    for (const finding of section.info) console.log(`  INFO:  ${finding.message}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
