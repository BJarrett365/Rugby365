#!/usr/bin/env npx tsx
/**
 * Rebuild player_team_memberships from fixtures, season stats and transfers.
 * Usage: npx tsx scripts/rebuild-player-memberships.ts [--competition=slug] [--season-id=uuid]
 */
import { and, desc, eq } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { rebuildTeamSeasonMemberships } from "../apps/web/src/lib/player-membership-service";
import { parseSeasonStartYear } from "../apps/web/src/lib/season-label-utils";

async function main() {
  const compSlug = process.argv.find((arg) => arg.startsWith("--competition="))?.split("=")[1];
  const seasonIdArg = process.argv.find((arg) => arg.startsWith("--season-id="))?.split("=")[1];

  const db = getDb();
  let competitionRows = await db.select().from(competitions);
  if (compSlug) {
    competitionRows = competitionRows.filter((row) => row.slug === compSlug);
  }

  for (const competition of competitionRows) {
    const seasonConditions = [
      eq(competitionSeasons.competitionId, competition.id),
      eq(competitionSeasons.isDeprecated, false),
    ];
    if (seasonIdArg) seasonConditions.push(eq(competitionSeasons.id, seasonIdArg));

    const seasons = await db
      .select()
      .from(competitionSeasons)
      .where(and(...seasonConditions))
      .orderBy(desc(competitionSeasons.year));

    const season = seasons.find((row) => row.isActive) ?? seasons[0];
    if (!season) {
      console.log(`Skip ${competition.name}: no season`);
      continue;
    }

    const seasonYear = season.year ?? parseSeasonStartYear(season.label);
    if (seasonYear == null) continue;

    const teams = await db
      .select({ teamId: standingRows.teamId })
      .from(standingRows)
      .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));

    console.log(`\n${competition.name} ${season.label} — ${teams.length} teams`);
    for (const { teamId } of teams) {
      const summary = await rebuildTeamSeasonMemberships({
        teamId,
        seasonId: season.id,
        competitionId: competition.id,
        seasonYear,
      });
      console.log(`  ${teamId.slice(0, 8)}… fixtures=${summary.uniqueFixturePlayers} transfers=${summary.transfers}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
