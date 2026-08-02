/**
 * Seed national teams onto the catch-all "International" competition seasons.
 *
 * Uses the latest men's World Rugby rankings as the nation roster:
 * - marks teams as team_type=international
 * - sets competition_type=international on the International competition
 * - writes standing_rows for every non-deprecated International season
 *   so Admin → Teams can list nations when a season is selected
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-international-competition-teams.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-international-competition-teams.ts --sync-rankings
 */
import { and, desc, eq, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  standingRows,
  teams,
  worldRankingRows,
  worldRankingSnapshots,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { syncWorldRugbyRankings } from "../apps/web/src/lib/world-rugby-rankings-service";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";

const syncRankings = process.argv.includes("--sync-rankings");

/** Extra international sides that appear in fixtures but may not be on WR rankings. */
const EXTRA_INTERNATIONAL_SIDES = ["Barbarians", "British & Irish Lions", "Pacific Islanders"];

async function latestMensRankingTeams() {
  const db = getDb();
  const [latest] = await db
    .select()
    .from(worldRankingSnapshots)
    .where(eq(worldRankingSnapshots.category, "mru"))
    .orderBy(desc(worldRankingSnapshots.effectiveDate))
    .limit(1);
  if (!latest) {
    throw new Error("No men's World Rugby ranking snapshot found. Run with --sync-rankings.");
  }

  const rows = await db
    .select({
      position: worldRankingRows.position,
      teamId: worldRankingRows.teamId,
      teamName: worldRankingRows.teamName,
      teamAbbreviation: worldRankingRows.teamAbbreviation,
      countryCode: worldRankingRows.countryCode,
    })
    .from(worldRankingRows)
    .where(eq(worldRankingRows.snapshotId, latest.id));

  rows.sort((a, b) => a.position - b.position);
  return { snapshot: latest, rows };
}

async function main() {
  const db = getDb();

  if (syncRankings) {
    console.log("Syncing men's World Rugby rankings…");
    const result = await syncWorldRugbyRankings("mru");
    console.log(`  synced ${result.rowsUpserted} rows (effective ${result.effectiveDate})`);
  }

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "international-matches-n062z68w"))
    .limit(1);
  if (!competition) throw new Error("International competition not found");

  if (competition.competitionType !== "international") {
    await db
      .update(competitions)
      .set({ competitionType: "international" })
      .where(eq(competitions.id, competition.id));
    console.log(`Fixed competition_type: ${competition.competitionType} → international`);
  } else {
    console.log("Competition type already international");
  }

  const { snapshot, rows } = await latestMensRankingTeams();
  console.log(`Using WR men's rankings ${snapshot.effectiveDate}: ${rows.length} nations`);

  const roster: Array<{
    teamId: string;
    position: number;
    teamName: string;
    teamAbbreviation: string | null;
  }> = [];

  for (const row of rows) {
    if (!row.teamId) {
      console.warn(`  ranking #${row.position} ${row.teamName} has no team id — resolving`);
      const team = await resolveTeam({
        name: row.teamName,
        createIfMissing: true,
        sourceProvider: "world_rugby",
      });
      if (!team) continue;
      roster.push({
        teamId: team.id,
        position: row.position,
        teamName: row.teamName,
        teamAbbreviation: row.teamAbbreviation,
      });
      continue;
    }
    roster.push({
      teamId: row.teamId,
      position: row.position,
      teamName: row.teamName,
      teamAbbreviation: row.teamAbbreviation,
    });
  }

  let nextRank = roster.length + 1;
  for (const name of EXTRA_INTERNATIONAL_SIDES) {
    const team = await resolveTeam({
      name,
      createIfMissing: true,
      sourceProvider: "manual",
    });
    if (!team) continue;
    if (roster.some((r) => r.teamId === team.id)) continue;
    roster.push({
      teamId: team.id,
      position: nextRank,
      teamName: team.name,
      teamAbbreviation: team.shortName,
    });
    nextRank += 1;
    console.log(`  + extra side ${team.name}`);
  }

  let marked = 0;
  for (const row of roster) {
    const [existing] = await db.select().from(teams).where(eq(teams.id, row.teamId)).limit(1);
    if (!existing) continue;
    const patch: Partial<typeof teams.$inferInsert> = {};
    if (existing.teamType !== "international") patch.teamType = "international";
    if (!existing.shortName && row.teamAbbreviation) patch.shortName = row.teamAbbreviation;
    if (!existing.countryName && !/barbarian|lions|islander/i.test(row.teamName)) {
      patch.countryName = row.teamName;
    }
    if (Object.keys(patch).length) {
      await db.update(teams).set(patch).where(eq(teams.id, row.teamId));
      marked += 1;
    }
  }
  console.log(`Updated ${marked} team record(s) (type/shortName/country)`);

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.competitionId, competition.id),
        eq(competitionSeasons.isDeprecated, false),
      ),
    );

  console.log(`Seeding standings onto ${seasons.length} International season(s) × ${roster.length} nations…`);

  let seeded = 0;
  let already = 0;

  for (const season of seasons) {
    const existing = await db
      .select({ teamId: standingRows.teamId })
      .from(standingRows)
      .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));
    const have = new Set(existing.map((r) => r.teamId));

    const toInsert = roster
      .filter((r) => !have.has(r.teamId))
      .map((r) => ({
        seasonId: season.id,
        teamId: r.teamId,
        view: "overall" as const,
        rank: r.position,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        bonusPoints: 0,
        tryBonusPoints: 0,
        losingBonusPoints: 0,
        pointsDeduction: 0,
        points: 0,
        form: null as string | null,
        syncedAt: new Date(),
      }));

    already += roster.length - toInsert.length;
    if (toInsert.length === 0) {
      console.log(`  ${season.label}: already has ${have.size}`);
      continue;
    }

    const chunk = 80;
    for (let i = 0; i < toInsert.length; i += chunk) {
      await db.insert(standingRows).values(toInsert.slice(i, i + chunk));
    }
    seeded += toInsert.length;
    console.log(`  ${season.label}: +${toInsert.length} nations`);
  }

  const [check] = await db.execute(sql`
    select count(distinct sr.team_id)::int as teams
    from standing_rows sr
    join competition_seasons s on s.id = sr.season_id
    where s.competition_id = ${competition.id} and sr.view = 'overall'
      and s.year = (select max(year) from competition_seasons where competition_id = ${competition.id})
  `);

  console.log(`\nDone. seeded=${seeded} already=${already}`);
  console.log(`Latest season now has ${check?.teams ?? "?"} distinct teams in standings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
