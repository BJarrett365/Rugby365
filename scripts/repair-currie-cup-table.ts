/**
 * Repair Currie Cup 2026 season assignment + sync SDMS standings/results.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-currie-cup-table.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const { createDb, fixtures } = await import("@rugby365/db");
  const { and, eq, gte, lt, sql } = await import("drizzle-orm");
  const { importPlanetRugbyCompetition } = await import(
    "../apps/web/src/lib/planet-rugby-import-service"
  );
  const { syncCompetitionStandings } = await import(
    "../apps/web/src/lib/standings-sync-service"
  );

  const db = createDb();
  const COMP = "c59f443b-6f56-46f1-a18a-7d9b5a8490d0";
  const SEASON_2526 = "d75a9fac-7a09-4708-a914-cf6ae881a01e";
  const SEASON_2627 = "09f62718-8cfa-4b95-a0d2-c9a020ffbd43";

  const moved = await db
    .update(fixtures)
    .set({ seasonId: SEASON_2627 })
    .where(
      and(
        eq(fixtures.competitionId, COMP),
        eq(fixtures.seasonId, SEASON_2526),
        gte(fixtures.kickoffAt, new Date("2026-07-01T00:00:00Z")),
        lt(fixtures.kickoffAt, new Date("2026-08-01T00:00:00Z")),
      ),
    )
    .returning({ id: fixtures.id, externalMatchId: fixtures.externalMatchId });

  console.log(
    `Moved ${moved.length} July fixtures → 2026–27:`,
    moved.map((m) => m.externalMatchId).join(", "),
  );

  const imported = await importPlanetRugbyCompetition({
    competitionId: COMP,
    seasonLabel: "2026",
    importResults: true,
    importFixtures: true,
    syncStandings: true,
    importMatchDetails: false,
  });
  console.log("Planet Rugby import:", imported);

  const standings = await syncCompetitionStandings(COMP, "2026");
  console.log("Standings sync:", standings);

  const [counts] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM fixtures
        WHERE competition_id = ${COMP}::uuid
          AND season_id = ${SEASON_2627}::uuid) AS fixtures_2627,
      (SELECT count(*) FROM fixtures
        WHERE competition_id = ${COMP}::uuid
          AND season_id = ${SEASON_2627}::uuid
          AND status IN ('full_time','completed','ft','finished')) AS completed_2627,
      (SELECT count(*) FROM standing_rows
        WHERE season_id = ${SEASON_2627}::uuid AND view = 'overall') AS standings_overall
  `);
  console.log("Season 2026–27 counts:", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
