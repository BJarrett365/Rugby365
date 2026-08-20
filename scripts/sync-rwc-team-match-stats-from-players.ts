/**
 * Build RWC team_match_stats by rolling up match scoring events + player
 * performance rows (SDMS / estimates / Opta). Skips seed fixtures and does not
 * overwrite existing SDMS team rows.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rwc-team-match-stats-from-players.ts --years=1987
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rwc-team-match-stats-from-players.ts --years=1987,1991,1995
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  players,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { isJunkPlayerName } from "../apps/web/src/lib/entity-normalize";
import { upsertTeamMatchStat } from "../apps/web/src/lib/team-match-stats-service";

const COMPETITION_SLUG = "rugby-world-cup";
const PROVIDER = "rwc_player_rollup";
const ADVANCED_PROVIDERS = [
  "sdms",
  "ai_algorithm_estimate",
  "opta_published_leaderboard",
] as const;

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));

function isSeedFixture(externalMatchId: string | null | undefined): boolean {
  if (!externalMatchId) return false;
  return (
    externalMatchId.startsWith("rwc-wiki-statistics:") ||
    externalMatchId.startsWith("rwc-opta-leaderboard:")
  );
}

function eventBucket(eventType: string | null | undefined): "try" | "conversion" | "penalty" | "drop_goal" | null {
  const t = (eventType ?? "").toLowerCase();
  if (t === "try" || t === "penalty_try") return "try";
  if (t === "conversion") return "conversion";
  if (t === "penalty") return "penalty";
  if (t === "drop_goal" || t === "dropgoal") return "drop_goal";
  return null;
}

function providerRank(provider: string | null | undefined): number {
  if (provider === "sdms") return 3;
  if (provider === "opta_published_leaderboard") return 2;
  if (provider === "ai_algorithm_estimate") return 1;
  return 0;
}

function numExtra(extras: unknown, key: string): number {
  if (!extras || typeof extras !== "object") return 0;
  const v = (extras as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
}

async function syncSeason(input: {
  competitionId: string;
  seasonId: string;
  year: number;
}): Promise<{ fixtures: number; upserted: number; skippedSdms: number; skippedSeed: number }> {
  const db = getDb();

  const seasonFixtures = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, input.seasonId), eq(fixtures.competitionId, input.competitionId)));

  let skippedSeed = 0;
  const realFixtures = seasonFixtures.filter((f) => {
    if (!f.homeTeamId || !f.awayTeamId) return false;
    if (isSeedFixture(f.externalMatchId)) {
      skippedSeed += 1;
      return false;
    }
    if (f.homeScore == null && f.awayScore == null) return false;
    return true;
  });

  const fixtureIds = realFixtures.map((f) => f.id);
  if (!fixtureIds.length) {
    return { fixtures: 0, upserted: 0, skippedSdms: 0, skippedSeed };
  }

  const existingSdms = await db
    .select({
      fixtureId: teamMatchStats.fixtureId,
      teamId: teamMatchStats.teamId,
    })
    .from(teamMatchStats)
    .where(
      and(
        inArray(teamMatchStats.fixtureId, fixtureIds),
        eq(teamMatchStats.sourceProvider, "sdms"),
      ),
    );
  const sdmsKeys = new Set(existingSdms.map((r) => `${r.fixtureId}:${r.teamId}`));

  const events = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, fixtureIds));

  const eventTeamIds = [...new Set(events.map((e) => e.teamId).filter(Boolean))] as string[];
  const fixtureTeamIds = [
    ...new Set(
      realFixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter(Boolean) as string[],
    ),
  ];
  const allTeamIds = [...new Set([...eventTeamIds, ...fixtureTeamIds])];
  const teamNameRows =
    allTeamIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, allTeamIds));
  const teamNameById = new Map(teamNameRows.map((t) => [t.id, t.name.trim().toLowerCase()]));

  const fixtureById = new Map(realFixtures.map((f) => [f.id, f]));

  const scoringByFixtureTeam = new Map<
    string,
    { tries: number; conversions: number; penalties: number; dropGoals: number }
  >();
  for (const ev of events) {
    if (!ev.teamId) continue;
    const bucket = eventBucket(ev.eventType);
    if (!bucket) continue;
    const fx = fixtureById.get(ev.fixtureId);
    if (!fx?.homeTeamId || !fx.awayTeamId) continue;

    let scoredTeamId = ev.teamId;
    if (scoredTeamId !== fx.homeTeamId && scoredTeamId !== fx.awayTeamId) {
      // Resolve duplicate nation entities (same name, different ids on fixtures vs events).
      const eventName = teamNameById.get(ev.teamId);
      const homeName = teamNameById.get(fx.homeTeamId);
      const awayName = teamNameById.get(fx.awayTeamId);
      if (eventName && eventName === homeName) scoredTeamId = fx.homeTeamId;
      else if (eventName && eventName === awayName) scoredTeamId = fx.awayTeamId;
      else continue;
    }

    const key = `${ev.fixtureId}:${scoredTeamId}`;
    const cur = scoringByFixtureTeam.get(key) ?? {
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
    };
    if (bucket === "try") cur.tries += 1;
    else if (bucket === "conversion") cur.conversions += 1;
    else if (bucket === "penalty") cur.penalties += 1;
    else cur.dropGoals += 1;
    scoringByFixtureTeam.set(key, cur);
  }

  const playerRows = await db
    .select({
      fixtureId: playerMatchPerformanceStats.fixtureId,
      teamId: playerMatchPerformanceStats.teamId,
      playerId: playerMatchPerformanceStats.playerId,
      playerName: players.name,
      sourceProvider: playerMatchPerformanceStats.sourceProvider,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      extras: playerMatchPerformanceStats.extras,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .where(
      and(
        inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
        inArray(playerMatchPerformanceStats.sourceProvider, [...ADVANCED_PROVIDERS]),
      ),
    );

  // Best advanced row per fixture+player (SDMS > Opta seed > estimate).
  const bestPlayer = new Map<string, (typeof playerRows)[number]>();
  for (const row of playerRows) {
    if (!row.fixtureId || isJunkPlayerName(row.playerName)) continue;
    const key = `${row.fixtureId}:${row.playerId}`;
    const existing = bestPlayer.get(key);
    if (!existing || providerRank(row.sourceProvider) > providerRank(existing.sourceProvider)) {
      bestPlayer.set(key, row);
    }
  }

  const advancedByFixtureTeam = new Map<
    string,
    {
      metres: number;
      carries: number;
      tackles: number;
      turnoversWon: number;
      offloads: number;
      cleanBreaks: number;
      defendersBeaten: number;
    }
  >();
  for (const row of bestPlayer.values()) {
    if (!row.fixtureId) continue;
    const key = `${row.fixtureId}:${row.teamId}`;
    const cur = advancedByFixtureTeam.get(key) ?? {
      metres: 0,
      carries: 0,
      tackles: 0,
      turnoversWon: 0,
      offloads: 0,
      cleanBreaks: 0,
      defendersBeaten: 0,
    };
    cur.metres += row.metresCarried ?? 0;
    cur.carries += row.carries ?? 0;
    cur.tackles += row.tacklesCompleted ?? 0;
    cur.turnoversWon += row.turnoversWon ?? 0;
    cur.offloads += numExtra(row.extras, "offloads");
    cur.cleanBreaks += row.lineBreaks ?? 0;
    cur.defendersBeaten += row.defendersBeaten ?? 0;
    advancedByFixtureTeam.set(key, cur);
  }

  let upserted = 0;
  let skippedSdms = 0;

  for (const fx of realFixtures) {
    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? fx.homeTeamId! : fx.awayTeamId!;
      const matchPoints = side === "home" ? (fx.homeScore ?? 0) : (fx.awayScore ?? 0);
      const key = `${fx.id}:${teamId}`;

      if (sdmsKeys.has(key)) {
        skippedSdms += 1;
        continue;
      }

      const scoring = scoringByFixtureTeam.get(key) ?? {
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
      };
      const advanced = advancedByFixtureTeam.get(key) ?? {
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        offloads: 0,
        cleanBreaks: 0,
        defendersBeaten: 0,
      };

      await upsertTeamMatchStat({
        fixtureId: fx.id,
        teamId,
        side,
        seasonId: input.seasonId,
        competitionId: input.competitionId,
        externalMatchId: fx.externalMatchId ?? `fixture:${fx.id}`,
        sourceProvider: PROVIDER,
        skipCascade: true,
        stats: {
          side,
          tries: scoring.tries,
          conversions: scoring.conversions,
          penalties: scoring.penalties,
          dropGoals: scoring.dropGoals,
          carries: advanced.carries,
          metres: advanced.metres,
          tackles: advanced.tackles,
          turnoversWon: advanced.turnoversWon,
          sections: {
            scoring: { match_points: matchPoints },
            attack: {
              offloads: advanced.offloads,
              clean_breaks: advanced.cleanBreaks,
              defenders_beaten: advanced.defendersBeaten,
            },
          },
        },
      });
      upserted += 1;
    }
  }

  return { fixtures: realFixtures.length, upserted, skippedSdms, skippedSeed };
}

async function main() {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup not found");

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));

  const selected = seasons
    .filter((s) => s.year != null && s.year >= 1987 && s.year <= 2023)
    .filter((s) => !onlyYears?.length || onlyYears.includes(s.year!))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  console.log(
    `Syncing RWC team match stats from players/events for ${selected.map((s) => s.year).join(", ") || "(none)"}`,
  );

  for (const season of selected) {
    const result = await syncSeason({
      competitionId: competition.id,
      seasonId: season.id,
      year: season.year!,
    });
    console.log(
      `  ${season.year}: fixtures=${result.fixtures} upserted=${result.upserted} skippedSdms=${result.skippedSdms} skippedSeed=${result.skippedSeed}`,
    );
  }

  console.log("Done. Refresh /competitions/rugby-world-cup/team-stats to verify boards.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
