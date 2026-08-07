/**
 * Seed RWC advanced leaderboard metrics (tackles/metres/carries/assists/…)
 * from published Opta tournament summaries into player_match_performance_stats.
 *
 * Wikipedia / rugbydatabase do not publish these for historical cups; Planet SDMS
 * only exposes RWC seasons 2023/2027. This fills public boards with verified
 * published leader values (partial top-N) without inventing missing numbers.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rwc-opta-leaderboards.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rwc-opta-leaderboards.ts --years=2015,2019
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertMatchPerformanceStat } from "../apps/web/src/lib/player-season-stats-service";
import { normalizePlayerName, normalizedEntityKey } from "../apps/web/src/lib/entity-normalize";

const CATALOG = join(
  process.cwd(),
  "docs/scraped/rwc-advanced-leaderboards/opta-tournament-leaders.json",
);
const COMPETITION_SLUG = "rugby-world-cup";
const PROVIDER = "opta_published_leaderboard";

type CatalogEntry = {
  playerName: string;
  teamName: string;
  aliases?: string[];
  tacklesCompleted?: number;
  metresCarried?: number;
  carries?: number;
  tryAssists?: number;
  defendersBeaten?: number;
  lineBreaks?: number;
  turnoversWon?: number;
  dominantTackles?: number;
  postContactMetres?: number;
};

type Catalog = {
  seasons: Record<string, { entries: CatalogEntry[]; note?: string }>;
};

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));

function nameKey(name: string) {
  return normalizedEntityKey(normalizePlayerName(name), "player");
}

function teamKey(name: string) {
  return normalizedEntityKey(name, "team");
}

async function ensureSeedFixture(input: {
  competitionId: string;
  seasonId: string;
  year: number;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const db = getDb();
  const externalMatchId = `rwc-opta-leaderboard:${input.year}`;
  const slug = `rwc-${input.year}-opta-leaderboard-seed`;
  const [existing] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.externalMatchId, externalMatchId))
    .limit(1);
  if (existing) return existing.id;

  const [bySlug] = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.slug, slug)).limit(1);
  if (bySlug) {
    await db
      .update(fixtures)
      .set({
        externalMatchId,
        competitionId: input.competitionId,
        seasonId: input.seasonId,
        stage: "stats_seed",
        status: "void",
        providerSnapshot: {
          kind: PROVIDER,
          year: input.year,
          hiddenFromPublicFixtures: true,
        },
      })
      .where(eq(fixtures.id, bySlug.id));
    return bySlug.id;
  }

  const [created] = await db
    .insert(fixtures)
    .values({
      slug,
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      stage: "stats_seed",
      status: "void",
      competitionName: `Rugby World Cup ${input.year} (Opta leaderboard seed)`,
      externalMatchId,
      round: "stats_seed",
      kickoffAt: new Date(`${input.year}-12-31T12:00:00.000Z`),
      providerSnapshot: {
        kind: PROVIDER,
        year: input.year,
        hiddenFromPublicFixtures: true,
      },
    })
    .returning({ id: fixtures.id });
  return created!.id;
}

async function resolvePlayerInSeason(input: {
  seasonId: string;
  competitionId: string;
  playerName: string;
  aliases?: string[];
  teamName: string;
}) {
  const db = getDb();
  const candidates = [input.playerName, ...(input.aliases ?? [])];
  const keys = new Set(candidates.map(nameKey));

  const seasonFixtures = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.seasonId, input.seasonId),
        eq(fixtures.competitionId, input.competitionId),
        sql`${fixtures.stage} <> 'stats_seed'`,
      ),
    );
  const fixtureIds = seasonFixtures.map((f) => f.id);
  if (!fixtureIds.length) return null;

  const squad = await db
    .select({
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      playerName: players.name,
      teamName: teams.name,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
    .where(inArray(fixturePlayers.fixtureId, fixtureIds));

  const wantedTeam = teamKey(input.teamName);
  const byName = squad.filter((row) => keys.has(nameKey(row.playerName)));
  const teamMatched = byName.filter((row) => teamKey(row.teamName) === wantedTeam);
  const pick = teamMatched[0] ?? byName[0];
  if (pick) return { playerId: pick.playerId, teamId: pick.teamId, matchedName: pick.playerName };

  // Global fallback (may match wrong era player — prefer squad).
  for (const candidate of candidates) {
    const [global] = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(sql`lower(${players.name}) = ${candidate.toLowerCase()}`)
      .limit(1);
    if (!global) continue;
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(sql`lower(${teams.name}) = ${input.teamName.toLowerCase()}`)
      .limit(1);
    if (!team) continue;
    return { playerId: global.id, teamId: team.id, matchedName: global.name };
  }
  return null;
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as Catalog;
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup missing");

  const seasons = (await db.select().from(competitionSeasons).where(eq(competitionSeasons.competitionId, competition.id)))
    .filter((s) => s.year != null && s.year <= 2019)
    .filter((s) => !onlyYears?.length || onlyYears.includes(s.year!))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  console.log(`Seeding Opta published advanced leaders for ${seasons.map((s) => s.year).join(", ")}`);

  for (const season of seasons) {
    const year = season.year!;
    const block = catalog.seasons[String(year)];
    if (!block) {
      console.log(`  ${year}: no catalog block`);
      continue;
    }
    if (block.note) console.log(`  ${year}: note — ${block.note}`);
    if (!block.entries.length) {
      console.log(`  ${year}: 0 entries`);
      continue;
    }

    // Pick any two real season teams for FK scaffolding on the seed fixture.
    const seasonTeams = await db
      .selectDistinct({ teamId: fixturePlayers.teamId })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
      .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.competitionId, competition.id)))
      .limit(2);
    const homeTeamId = seasonTeams[0]?.teamId;
    const awayTeamId = seasonTeams[1]?.teamId ?? seasonTeams[0]?.teamId;
    if (!homeTeamId || !awayTeamId) {
      console.log(`  ${year}: no squad teams — skip`);
      continue;
    }

    const fixtureId = await ensureSeedFixture({
      competitionId: competition.id,
      seasonId: season.id,
      year,
      homeTeamId,
      awayTeamId,
    });

    let upserted = 0;
    let unmatched = 0;
    for (const entry of block.entries) {
      const resolved = await resolvePlayerInSeason({
        seasonId: season.id,
        competitionId: competition.id,
        playerName: entry.playerName,
        aliases: entry.aliases,
        teamName: entry.teamName,
      });
      if (!resolved) {
        unmatched += 1;
        console.log(`    ! unmatched ${entry.playerName} (${entry.teamName})`);
        continue;
      }

      await upsertMatchPerformanceStat({
        fixtureId,
        playerId: resolved.playerId,
        teamId: resolved.teamId,
        seasonId: season.id,
        competitionId: competition.id,
        externalMatchId: `rwc-opta-leaderboard:${year}`,
        externalPlayerId: `leader:${resolved.playerId}`,
        sourceProvider: PROVIDER,
        skipBioRefresh: true,
        stats: {
          minutesPlayed: 0,
          tries: 0,
          points: 0,
          carries: entry.carries ?? 0,
          metresCarried: entry.metresCarried ?? 0,
          tacklesMade: entry.tacklesCompleted ?? 0,
          tacklesCompleted: entry.tacklesCompleted ?? 0,
          dominantTackles: entry.dominantTackles ?? 0,
          turnoversWon: entry.turnoversWon ?? 0,
          tryAssists: entry.tryAssists ?? 0,
          lineBreaks: entry.lineBreaks ?? 0,
          defendersBeaten: entry.defendersBeaten ?? 0,
          touches: 0,
          postContactMetres: entry.postContactMetres ?? 0,
          ruckArrivalEffectiveness: 0,
          passes: 0,
          offloads: 0,
          missedTackles: 0,
          kicks: 0,
          kicksFromHand: 0,
          kickFromHandMetres: 0,
          kickPossessionRetained: 0,
          badPasses: 0,
          droppedCatch: 0,
          handlingError: 0,
          turnoversConceded: 0,
          runs: 0,
          gainLine: 0,
          carriesMetres: entry.metresCarried ?? 0,
          carriesCrossedGainLine: 0,
          carriesNotMadeGainLine: 0,
        },
      });
      upserted += 1;
    }
    console.log(`  ${year}: upserted=${upserted} unmatched=${unmatched}`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
