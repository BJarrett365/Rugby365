#!/usr/bin/env npx tsx
/**
 * Full squad audit across competitions — membership vs club_team_id vs transfers.
 * Usage: npx tsx scripts/audit-player-squads.ts [--rebuild] [--competition=premiership] [--json]
 */
import { runFullSquadAudit, formatSquadAuditSummaryForTeam } from "../apps/web/src/lib/player-squad-audit-service";

async function main() {
  const json = process.argv.includes("--json");
  const rebuild = process.argv.includes("--rebuild");
  const competitionId = process.argv.find((arg) => arg.startsWith("--competition-id="))?.split("=")[1];
  const competitionSlug = process.argv.find((arg) => arg.startsWith("--competition="))?.split("=")[1];

  let resolvedCompetitionId = competitionId;
  if (!resolvedCompetitionId && competitionSlug) {
    const { getCompetitionBySlug } = await import("../apps/web/src/lib/competition-admin-service");
    const competition = await getCompetitionBySlug(competitionSlug);
    resolvedCompetitionId = competition?.id;
  }

  const report = await runFullSquadAudit({
    competitionId: resolvedCompetitionId,
    rebuildMemberships: rebuild,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Squad audit — ${report.generatedAt}`);
  console.log(
    `Competitions: ${report.competitionCount}  Teams: ${report.teamCount}  Historic leaks: ${report.totals.historicLeaking}  Departed stale: ${report.totals.departed}  Duplicates: ${report.totals.duplicateGroups}\n`,
  );

  for (const team of report.teams) {
    if (
      team.historicLeaking.length === 0 &&
      team.departed.length === 0 &&
      team.duplicateGroups.length === 0 &&
      team.reversedNames.length === 0
    ) {
      continue;
    }
    console.log(formatSquadAuditSummaryForTeam(team));
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
