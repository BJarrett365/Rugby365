/**
 * Repair Rugby Data mis-links where "Autumn Nations Cup" fixtures/results were
 * imported under the wrong competitionId (actually Nations Cup matches).
 *
 * What we do:
 * - Detect fixtures currently stored under *Autumn Nations Cup* competition rows
 *   whose provider snapshot league string contains "World Rugby Nations Cup"
 *   (but not "Autumn").
 * - Move those fixtures to the *World Rugby Nations Cup* competition, matching
 *   by season year.
 * - Move the corresponding standing_rows (all views) from the Autumn seasonId
 *   to the World Rugby Nations Cup seasonId.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-autumn-nations-cup-separation.ts
 */

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { competitions, competitionSeasons, fixtures, standingRows } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertSeason } from "../apps/web/src/lib/competition-admin-service";

const dryRun = process.argv.includes("--dry-run");

function includesNationsCupButNotAutumn(league: unknown): boolean {
  if (!league || typeof league !== "string") return false;
  const lower = league.toLowerCase();
  return lower.includes("nations cup") && !lower.includes("autumn");
}

async function findCompetitionIdsBySlugPrefix(prefix: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: competitions.id, slug: competitions.slug })
    .from(competitions)
    .where(like(competitions.slug, `${prefix}%`));
  // Include legacy rows too: fixtures/results can exist under both.
  return rows.map((r) => r.id);
}

async function main() {
  const db = getDb();

  const autumnCompetitionIds = await findCompetitionIdsBySlugPrefix("autumn-nations-cup");
  const worldRows = await db
    .select({ id: competitions.id, slug: competitions.slug, name: competitions.name })
    .from(competitions)
    .where(eq(competitions.slug, "world-rugby-nations-cup"));
  const worldComp = worldRows[0];

  if (!autumnCompetitionIds.length || !worldComp) {
    console.log("No competitions found to repair", { autumnCompetitionIds, worldComp });
    return;
  }

  console.log("Repair start", {
    autumnCompetitionIds,
    worldComp: { id: worldComp.id, name: worldComp.name },
    dryRun,
  });

  // 1) Find mislinked fixtures under Autumn comp IDs whose provider snapshot says Nations Cup.
  const autumnFixtures = await db.select({
    id: fixtures.id,
    seasonId: fixtures.seasonId,
    providerSnapshot: fixtures.providerSnapshot,
  }).from(fixtures).where(inArray(fixtures.competitionId, autumnCompetitionIds));

  const mislinked = autumnFixtures.filter((f) => {
    if (!f.seasonId) return false; // standing rows need a seasonId
    const league = (f.providerSnapshot as any)?.rugby_data?.league;
    return includesNationsCupButNotAutumn(league);
  });

  const affectedSeasonIds = [...new Set(mislinked.map((f) => f.seasonId!))];
  console.log("Mislinked fixtures", {
    mislinkedCount: mislinked.length,
    affectedSeasonIds: affectedSeasonIds.length,
  });

  if (!mislinked.length) {
    console.log("Nothing to repair.");
    return;
  }

  // 2) Map Autumn seasonIds → World seasonIds (by year).
  const autumnSeasons = await db
    .select({
      id: competitionSeasons.id,
      year: competitionSeasons.year,
      label: competitionSeasons.label,
    })
    .from(competitionSeasons)
    .where(inArray(competitionSeasons.id, affectedSeasonIds));

  const yearToWorldSeason = new Map<number, { id: string; label: string }>();
  const worldSeasonRows = await db
    .select({ id: competitionSeasons.id, year: competitionSeasons.year, label: competitionSeasons.label })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, worldComp.id));

  for (const s of worldSeasonRows) yearToWorldSeason.set(s.year, { id: s.id, label: s.label });

  const anyLabel = worldSeasonRows[0]?.label ?? "";
  const guessSeasonKind: "club" | "international" | "tournament" =
    anyLabel.includes("–") ? "club" : "tournament";

  for (const autumnSeason of autumnSeasons) {
    const year = autumnSeason.year;
    if (yearToWorldSeason.has(year)) continue;
    const created = await upsertSeason({
      competitionId: worldComp.id,
      label: String(year),
      isActive: true,
      seasonKind: guessSeasonKind,
    });
    yearToWorldSeason.set(year, { id: created.id, label: created.label });
  }

  // 3) Move fixtures.
  const movedFixtureByAutumnSeason = new Map<string, string[]>();
  for (const f of mislinked) {
    const key = f.seasonId!;
    const list = movedFixtureByAutumnSeason.get(key) ?? [];
    list.push(f.id);
    movedFixtureByAutumnSeason.set(key, list);
  }

  for (const autumnSeasonId of affectedSeasonIds) {
    const autumnSeason = autumnSeasons.find((s) => s.id === autumnSeasonId);
    if (!autumnSeason) continue;
    const target = yearToWorldSeason.get(autumnSeason.year);
    if (!target) continue;
    const ids = movedFixtureByAutumnSeason.get(autumnSeasonId) ?? [];
    if (!ids.length) continue;

    console.log("  move fixtures", {
      autumnSeasonId,
      targetSeasonId: target.id,
      fixtureCount: ids.length,
    });

    if (dryRun) continue;
    await db
      .update(fixtures)
      .set({
        competitionId: worldComp.id,
        competitionName: worldComp.name,
        seasonId: target.id,
      })
      .where(inArray(fixtures.id, ids));
  }

  // 4) Move standings rows (all views) for those Autumn seasonIds.
  const views = ["overall", "home", "away"]; // known StandingView values
  const standingRowsToMove = await db
    .select()
    .from(standingRows)
    .where(and(inArray(standingRows.seasonId, affectedSeasonIds), inArray(standingRows.view, views)));

  console.log("Standing rows to move", standingRowsToMove.length);

  if (!dryRun) {
    // Delete target rows for (seasonId, teamId, view) we are about to insert, to avoid unique constraint collisions.
    // Then insert moved rows.
    for (const autumnSeasonId of affectedSeasonIds) {
      const autumnSeason = autumnSeasons.find((s) => s.id === autumnSeasonId);
      if (!autumnSeason) continue;
      const target = yearToWorldSeason.get(autumnSeason.year);
      if (!target) continue;

      const moved = standingRowsToMove.filter((r) => r.seasonId === autumnSeasonId);
      if (!moved.length) continue;

      const deleteKeys = new Set(moved.map((r) => `${r.teamId}:${r.view}`));
      for (const key of deleteKeys) {
        const [teamId, view] = key.split(":");
        await db
          .delete(standingRows)
          .where(and(eq(standingRows.seasonId, target.id), eq(standingRows.teamId, teamId), eq(standingRows.view, view)));
      }

      // Insert moved rows under the target seasonId.
      await db.insert(standingRows).values(
        moved.map((r) => ({
          seasonId: target.id,
          teamId: r.teamId,
          view: r.view,
          rank: r.rank,
          played: r.played,
          won: r.won,
          draw: r.draw,
          lost: r.lost,
          pointsFor: r.pointsFor,
          pointsAgainst: r.pointsAgainst,
          pointsDiff: r.pointsDiff,
          bonusPoints: r.bonusPoints,
          tryBonusPoints: r.tryBonusPoints,
          losingBonusPoints: r.losingBonusPoints,
          pointsDeduction: r.pointsDeduction,
          points: r.points,
          form: r.form,
          syncedAt: r.syncedAt ?? new Date(),
        })),
      );

      // Delete the old rows.
      await db.delete(standingRows).where(and(inArray(standingRows.seasonId, [autumnSeasonId])));
    }
  }

  console.log("Repair complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

