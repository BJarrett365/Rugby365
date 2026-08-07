/**
 * Import scraped Rugby World Cup tournament.json files into the DB:
 * - competition metadata (bio)
 * - pool membership catalog refresh (printed for manual sync)
 * - standing_rows rewritten from official/Ultimate Rugby pool tables
 *
 * Prerequisite:
 *   npx tsx scripts/scrape-rugby-world-cup.ts
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-scraped-rugby-world-cup.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-scraped-rugby-world-cup.ts --years=2019,2023
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";

const ROOT = join(process.cwd(), "docs/scraped/rugby-world-cup");

type ScrapedStanding = {
  pool: string;
  rank: number;
  teamName: string;
  played: number;
  won?: number;
  lost?: number;
  draw?: number;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  pointsDiff?: number | null;
  tryBonus?: number | null;
  losingBonus?: number | null;
  points: number;
};

type TournamentJson = {
  year: number;
  competition: {
    competitionName: string;
    governingBody: string;
    officialWebsite: string;
    host: string | null;
    dateRange: string | null;
    description: string | null;
    tournamentFormat: string;
    numberOfTeams: number;
    numberOfPools: number;
    numberOfMatches: number;
  };
  ultimateRugby: {
    pools: Array<{ pool: string; rows: ScrapedStanding[] }>;
  };
  official: null | {
    host: string | null;
    dateRange: string | null;
    description: string | null;
    pools: Array<{
      pool: string;
      rows: Array<{
        rank: number;
        teamCode: string;
        teamName?: string;
        played: number;
        pointsDiff: number;
        points: number;
      }>;
    }>;
  };
};

const CODE_TO_NAME: Record<string, string> = {
  NZL: "New Zealand",
  AUS: "Australia",
  ENG: "England",
  FRA: "France",
  IRE: "Ireland",
  WAL: "Wales",
  SCO: "Scotland",
  ITA: "Italy",
  ARG: "Argentina",
  RSA: "South Africa",
  SAM: "Samoa",
  TGA: "Tonga",
  FIJ: "Fiji",
  JPN: "Japan",
  GEO: "Georgia",
  USA: "United States",
  CAN: "Canada",
  ROU: "Romania",
  NAM: "Namibia",
  URU: "Uruguay",
  ESP: "Spain",
  RUS: "Russia",
  POR: "Portugal",
  CHI: "Chile",
  ZIM: "Zimbabwe",
};

function preferredStandings(data: TournamentJson): ScrapedStanding[] {
  // Prefer Ultimate Rugby when it has full W/D/L columns.
  if (data.ultimateRugby.pools.some((p) => p.rows.length > 0)) {
    return data.ultimateRugby.pools.flatMap((p) =>
      p.rows.map((row) => ({ ...row, pool: p.pool })),
    );
  }
  if (data.official?.pools?.length) {
    return data.official.pools.flatMap((p) =>
      p.rows.map((row) => ({
        pool: p.pool,
        rank: row.rank,
        teamName: row.teamName || CODE_TO_NAME[row.teamCode] || row.teamCode,
        played: row.played,
        pointsDiff: row.pointsDiff,
        points: row.points,
      })),
    );
  }
  return [];
}

function poolCatalogSnippet(data: TournamentJson): string {
  const pools =
    data.ultimateRugby.pools.length > 0
      ? data.ultimateRugby.pools
      : (data.official?.pools ?? []).map((p) => ({
          pool: p.pool,
          rows: p.rows.map((r) => ({
            teamName: r.teamName || CODE_TO_NAME[r.teamCode] || r.teamCode,
          })),
        }));
  if (!pools.length) return "";
  const entries = pools
    .map((p) => {
      const id = p.pool.replace(/^Pool\s+/i, "");
      const teams = p.rows
        .map((r) => `"${"teamName" in r ? r.teamName : (r as { teamName?: string }).teamName}"`)
        .join(", ");
      return `    { id: "${id}", label: "Pool ${id}", teams: [${teams}] },`;
    })
    .join("\n");
  return `  ${data.year}: [\n${entries}\n  ],`;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--years="));
  const yearFilter = arg
    ? new Set(
        arg
          .slice("--years=".length)
          .split(",")
          .map((y) => Number(y.trim()))
          .filter(Boolean),
      )
    : null;

  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup competition not found");

  const years = readdirSync(ROOT)
    .map((name) => Number(name))
    .filter((y) => Number.isFinite(y))
    .filter((y) => !yearFilter || yearFilter.has(y))
    .sort((a, b) => a - b);

  const catalogParts: string[] = [];
  let seasonsUpdated = 0;
  let rowsUpserted = 0;

  // Competition-level metadata (latest description/host summary).
  const latest = years.includes(2027) ? 2027 : years[years.length - 1]!;
  const latestJson = JSON.parse(
    readFileSync(join(ROOT, String(latest), "tournament.json"), "utf8"),
  ) as TournamentJson;
  const bio = [
    "Men's Rugby World Cup — World Rugby.",
    latestJson.competition.tournamentFormat,
    `Official site: ${latestJson.competition.officialWebsite}`,
    `Seasons scraped: ${years.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
  await db
    .update(competitions)
    .set({
      bioSummary: bio,
      competitionType: "world_cup",
      format: "tournament",
    })
    .where(eq(competitions.id, competition.id));
  console.log("Updated competition bio/metadata");

  for (const year of years) {
    const data = JSON.parse(
      readFileSync(join(ROOT, String(year), "tournament.json"), "utf8"),
    ) as TournamentJson;
    catalogParts.push(poolCatalogSnippet(data));

    const standings = preferredStandings(data);
    if (!standings.length) {
      console.log(`\n${year}: no pool standings in scrape — skip DB upsert`);
      continue;
    }

    const [season] =
      (await db
        .select()
        .from(competitionSeasons)
        .where(
          and(
            eq(competitionSeasons.competitionId, competition.id),
            eq(competitionSeasons.year, year),
          ),
        )
        .limit(1)) ?? [];

    if (!season) {
      console.log(`\n${year}: no season row in DB — skip (create via Wikipedia import first)`);
      continue;
    }

    console.log(`\n${year}: upserting ${standings.length} standing rows into ${season.label}`);

    // Replace overall standings for this season with pool-relative ranks (same model as before).
    await db.delete(standingRows).where(eq(standingRows.seasonId, season.id));

    for (const row of standings) {
      const resolved = await resolveTeam({
        name: row.teamName,
        createIfMissing: true,
        sourceProvider: "rugby-world-cup-scrape",
      });
      if (!resolved?.id) {
        console.warn(`  skip unmapped team ${row.teamName}`);
        continue;
      }
      const teamId = resolved.id;

      const bonus =
        (row.tryBonus ?? 0) + (row.losingBonus ?? 0);
      await db.insert(standingRows).values({
        seasonId: season.id,
        teamId,
        view: "overall",
        rank: row.rank,
        played: row.played,
        won: row.won ?? 0,
        draw: row.draw ?? 0,
        lost: row.lost ?? 0,
        pointsFor: row.pointsFor ?? 0,
        pointsAgainst: row.pointsAgainst ?? 0,
        pointsDiff: row.pointsDiff ?? (row.pointsFor ?? 0) - (row.pointsAgainst ?? 0),
        bonusPoints: bonus,
        tryBonusPoints: row.tryBonus ?? 0,
        losingBonusPoints: row.losingBonus ?? 0,
        points: row.points,
        form: null,
        syncedAt: new Date(),
      });
      rowsUpserted += 1;
    }
    seasonsUpdated += 1;
  }

  const catalogOut = join(ROOT, "generated-pool-catalog.ts.fragment");
  writeFileSync(
    catalogOut,
    `// Generated from scraped tournament.json — merge into rugby-world-cup-pools.ts\nconst POOLS_BY_YEAR = {\n${catalogParts.filter(Boolean).join("\n")}\n} as const;\n`,
  );
  console.log(`\nWrote pool catalog fragment → ${catalogOut}`);
  console.log(`Done: seasons=${seasonsUpdated} standingRows=${rowsUpserted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
