/**
 * Import scraped Wikipedia RWC statistics JSON into player_match_performance_stats
 * so public stats boards pick up try/points leaders + any published advanced records.
 *
 * Prefer wiki scoring totals as the season board source: clears tries/points on
 * fixture_players / scoring_events performance rows for the season, then writes
 * wiki totals onto a stats_seed fixture.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rwc-statistics.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rwc-statistics.ts --years=2015,2019
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
import type { WikiStatEntry, WikiStatsYearFile } from "./scrape-wikipedia-rwc-statistics";

const ROOT = join(process.cwd(), "docs/scraped/wikipedia/rugby-world-cup-statistics");
const COMPETITION_SLUG = "rugby-world-cup";
const PROVIDER = "wikipedia_statistics";

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));
const skipScoringReset = args.includes("--keep-match-scoring");

function nameKey(name: string) {
  return normalizedEntityKey(normalizePlayerName(name), "player")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function teamKey(name: string) {
  const key = normalizedEntityKey(name, "team");
  if (key === "western samoa" || key === "samoa") return "samoa";
  return key;
}

async function ensureSeedFixture(input: {
  competitionId: string;
  seasonId: string;
  year: number;
  homeTeamId: string;
  awayTeamId: string;
  sourceUrl: string;
}) {
  const db = getDb();
  const externalMatchId = `rwc-wiki-statistics:${input.year}`;
  const slug = `rwc-${input.year}-wiki-statistics-seed`;
  const [existing] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.externalMatchId, externalMatchId))
    .limit(1);
  if (existing) return existing.id;

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
      competitionName: `Rugby World Cup ${input.year} (Wikipedia statistics seed)`,
      externalMatchId,
      round: "stats_seed",
      kickoffAt: new Date(`${input.year}-12-30T12:00:00.000Z`),
      providerSnapshot: {
        kind: PROVIDER,
        year: input.year,
        sourceUrl: input.sourceUrl,
        hiddenFromPublicFixtures: true,
      },
    })
    .returning({ id: fixtures.id });
  return created!.id;
}

async function resolvePlayer(input: {
  seasonId: string;
  competitionId: string;
  playerName: string;
  teamName?: string;
}) {
  const db = getDb();
  const key = nameKey(input.playerName);
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

  const byName = squad.filter((row) => nameKey(row.playerName) === key);
  if (input.teamName) {
    const wanted = teamKey(input.teamName);
    const teamHit = byName.find((row) => teamKey(row.teamName) === wanted);
    if (teamHit) return { playerId: teamHit.playerId, teamId: teamHit.teamId };
  }
  if (byName[0]) return { playerId: byName[0].playerId, teamId: byName[0].teamId };

  // Soft match: same surname + shared given-name stem (Jonathan ↔ Jon, Émile ↔ Emile).
  const wantedParts = nameKey(input.playerName).split(/\s+/).filter(Boolean);
  const wantedSur = wantedParts[wantedParts.length - 1] ?? "";
  const wantedGiven = wantedParts[0] ?? "";
  if (wantedSur && wantedGiven.length >= 3) {
    const soft = squad.filter((row) => {
      const parts = nameKey(row.playerName).split(/\s+/).filter(Boolean);
      const sur = parts[parts.length - 1] ?? "";
      const given = parts[0] ?? "";
      if (sur !== wantedSur) return false;
      return given === wantedGiven || given.startsWith(wantedGiven) || wantedGiven.startsWith(given);
    });
    const scoped = input.teamName
      ? soft.filter((row) => teamKey(row.teamName) === teamKey(input.teamName!))
      : soft;
    const unique = new Map(scoped.map((row) => [`${row.playerId}:${row.teamId}`, row]));
    if (unique.size === 1) {
      const hit = [...unique.values()][0]!;
      return { playerId: hit.playerId, teamId: hit.teamId };
    }
  }

  const [global] = await db
    .select({ id: players.id })
    .from(players)
    .where(sql`lower(${players.name}) = ${input.playerName.toLowerCase()}`)
    .limit(1);
  if (!global) return null;
  if (input.teamName) {
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(sql`lower(${teams.name}) = ${input.teamName.toLowerCase()}`)
      .limit(1);
    if (team) return { playerId: global.id, teamId: team.id };
  }
  // Prefer any squad team for this player if already appeared.
  const any = squad.find((s) => s.playerId === global.id);
  if (any) return { playerId: any.playerId, teamId: any.teamId };
  return null;
}

async function main() {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup missing");

  const files = existsSync(ROOT)
    ? readdirSync(ROOT)
        .filter((f) => /^\d{4}\.json$/.test(f))
        .map((f) => Number(f.replace(".json", "")))
        .filter((y) => !onlyYears?.length || onlyYears.includes(y))
        .sort((a, b) => a - b)
    : [];

  if (!files.length) {
    console.log("No scraped Wikipedia statistics JSON found. Run: npm run scrape:rwc:wiki-stats");
    return;
  }

  console.log(`Importing Wikipedia RWC statistics for ${files.join(", ")}`);

  for (const year of files) {
    const data = JSON.parse(readFileSync(join(ROOT, `${year}.json`), "utf8")) as WikiStatsYearFile;
    const [season] = await db
      .select()
      .from(competitionSeasons)
      .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
      .limit(1);
    if (!season) {
      console.log(`  ${year}: no season row — skip`);
      continue;
    }

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
      sourceUrl: data.sourceUrl,
    });

    const hasScoring = data.entries.some((e) => (e.tries ?? 0) > 0 || (e.points ?? 0) > 0);
    const { playerMatchPerformanceStats } = await import("@rugby365/db");

    // Resolve wiki entries first so we only blank match-level try/points for players
    // who get a confirmed Wikipedia seed (avoids double-count without wiping other scorers).
    const resolvedEntries: Array<{
      entry: WikiStatEntry;
      playerId: string;
      teamId: string;
    }> = [];
    let unmatched = 0;
    for (const entry of data.entries) {
      const resolved = await resolvePlayer({
        seasonId: season.id,
        competitionId: competition.id,
        playerName: entry.playerName,
        teamName: entry.teamName,
      });
      if (!resolved) {
        unmatched += 1;
        continue;
      }
      resolvedEntries.push({ entry, playerId: resolved.playerId, teamId: resolved.teamId });
    }

    if (hasScoring && !skipScoringReset && resolvedEntries.length) {
      const wikiPlayerIds = [...new Set(resolvedEntries.map((r) => r.playerId))];
      const cleared = await db
        .update(playerMatchPerformanceStats)
        .set({ tries: 0, points: 0 })
        .where(
          and(
            eq(playerMatchPerformanceStats.seasonId, season.id),
            eq(playerMatchPerformanceStats.competitionId, competition.id),
            inArray(playerMatchPerformanceStats.playerId, wikiPlayerIds),
            inArray(playerMatchPerformanceStats.sourceProvider, [
              "fixture_players",
              "scoring_events",
              "ai_algorithm_estimate",
            ]),
          ),
        )
        .returning({ id: playerMatchPerformanceStats.id });
      console.log(
        `  ${year}: cleared tries/points on ${cleared.length} match rows for ${wikiPlayerIds.length} wiki leaders`,
      );
    } else if (skipScoringReset) {
      // Drop prior wiki seed rows so we only re-add advanced metrics.
      await db
        .delete(playerMatchPerformanceStats)
        .where(
          and(
            eq(playerMatchPerformanceStats.seasonId, season.id),
            eq(playerMatchPerformanceStats.competitionId, competition.id),
            eq(playerMatchPerformanceStats.sourceProvider, PROVIDER),
          ),
        );
    }

    let upserted = 0;
    for (const { entry, playerId, teamId } of resolvedEntries) {
      const tries = skipScoringReset ? 0 : (entry.tries ?? 0);
      const points = skipScoringReset
        ? 0
        : (entry.points ??
          tries * 5 +
            (entry.conversions ?? 0) * 2 +
            (entry.penalties ?? 0) * 3 +
            (entry.dropGoals ?? 0) * 3);

      // When keeping match scoring, only seed advanced metrics / wiki leaders for boards
      // that match rows do not already cover well.
      const hasAdvanced =
        (entry.tacklesCompleted ?? 0) > 0 ||
        (entry.metresCarried ?? 0) > 0 ||
        (entry.carries ?? 0) > 0 ||
        (entry.lineBreaks ?? 0) > 0 ||
        (entry.turnoversWon ?? 0) > 0 ||
        (entry.defendersBeaten ?? 0) > 0 ||
        (entry.tryAssists ?? 0) > 0;
      if (skipScoringReset && !hasAdvanced) continue;

      await upsertMatchPerformanceStat({
        fixtureId,
        playerId,
        teamId,
        seasonId: season.id,
        competitionId: competition.id,
        externalMatchId: `rwc-wiki-statistics:${year}`,
        externalPlayerId: `wiki:${playerId}`,
        sourceProvider: PROVIDER,
        skipBioRefresh: true,
        stats: {
          minutesPlayed: 0,
          tries,
          points,
          carries: entry.carries ?? 0,
          metresCarried: entry.metresCarried ?? 0,
          tacklesMade: entry.tacklesCompleted ?? 0,
          tacklesCompleted: entry.tacklesCompleted ?? 0,
          dominantTackles: 0,
          turnoversWon: entry.turnoversWon ?? 0,
          tryAssists: entry.tryAssists ?? 0,
          lineBreaks: entry.lineBreaks ?? 0,
          defendersBeaten: entry.defendersBeaten ?? 0,
          touches: 0,
          postContactMetres: 0,
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
    console.log(
      `  ${year}: upserted=${upserted}/${data.entries.length} unmatched=${unmatched}`,
    );
  }

  console.log("Done. Refresh /competitions/rugby-world-cup/stats to verify boards.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
