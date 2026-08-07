/**
 * Backfill Rugby World Cup Team of the Week editions.
 *
 * Round model (RWC):
 *   Pool stage → Round 1 / Round 2 / Round 3 / … (calendar weeks from first pool kickoff)
 *   Knockouts  → Quarter Finals / Semi Finals / Bronze Final / Final
 *   Plus       → Team of the Tournament (all completed matches)
 *
 * Steps:
 *   1) Rewrite fixture.round labels to that model
 *   2) Calculate match ratings for completed fixtures
 *   3) Generate TotW for each round + Team of the Tournament
 *   4) Optionally publish
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-team-of-the-week.ts --years=2011,2015,2019,2023 --publish
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-team-of-the-week.ts --years=1987,1991,1995,1999,2003,2007,2011,2015,2019,2023 --publish
 */
import { and, eq } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { calculateAndPersistFixtureMatchRatings } from "../apps/web/src/lib/match-rating-service";
import { isFixtureRatingsPublished } from "../apps/web/src/lib/match-rating-math";
import {
  generateTeamOfWeek,
  listRoundsForSeason,
  publishTeamOfWeekEdition,
} from "../apps/web/src/lib/team-of-week-service";
import { isWorldCupKnockoutStage } from "../apps/web/src/lib/rugby-world-cup-pools";

const COMPETITION_SLUG = "rugby-world-cup";
const TOURNAMENT_ROUND_KEY = "team-of-the-tournament";

const args = process.argv.slice(2);
const onlyYears =
  args
    .find((a) => a.startsWith("--years="))
    ?.split("=")[1]
    ?.split(",")
    .map((y) => Number(y.trim()))
    .filter((y) => Number.isFinite(y)) ?? [
    1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023,
  ];
const publish = args.includes("--publish");
const skipRatings = args.includes("--skip-ratings");
const skipRoundRepair = args.includes("--skip-round-repair");
const dryRun = args.includes("--dry-run");
const concurrency = Math.max(
  1,
  Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 3) || 3,
);

function isSeedFixture(externalMatchId: string | null | undefined): boolean {
  if (!externalMatchId) return false;
  return (
    externalMatchId.startsWith("rwc-wiki-statistics:") ||
    externalMatchId.startsWith("rwc-opta-leaderboard:")
  );
}

function knockoutRoundLabel(stage: string | null, round: string | null): string | null {
  const s = (stage ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const r = (round ?? "").toLowerCase();
  if (s.includes("quarter") || /quarter/.test(r)) return "Quarter Finals";
  if (s.includes("semi") || /semi/.test(r)) return "Semi Finals";
  if (s.includes("bronze") || s.includes("playoff") || /bronze|3rd place|third place/.test(r)) {
    return "Bronze Final";
  }
  if (s === "final" || /^final$/.test(r.trim()) || r === "final") return "Final";
  if (s.includes("round_of_16") || /round of 16|last 16/.test(r)) return "Round of 16";
  return null;
}

async function mapPool<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
}

/**
 * Relabel every real RWC fixture into Round N (pool) or named knockout rounds.
 * Overwrites Pool A/B/C/D style labels so TotW editions match the product model.
 */
async function repairRoundsForSeason(input: {
  seasonId: string;
  year: number;
}): Promise<{ scanned: number; updated: number; poolRounds: number; knockouts: number }> {
  const db = getDb();
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      round: fixtures.round,
      stage: fixtures.stage,
      externalMatchId: fixtures.externalMatchId,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(eq(fixtures.seasonId, input.seasonId));

  const real = fixtureRows.filter((f) => !isSeedFixture(f.externalMatchId));
  const inYear = real.filter(
    (f) => f.kickoffAt != null && f.kickoffAt.getUTCFullYear() === input.year,
  );

  // Dense tournament window: completed fixtures within ±55 days of the median kickoff.
  const completed = inYear
    .filter((f) => isFixtureRatingsPublished(f.status) && f.kickoffAt)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  const medianKick =
    completed.length > 0
      ? completed[Math.floor(completed.length / 2)]!.kickoffAt!.getTime()
      : null;
  const WINDOW_MS = 55 * 24 * 60 * 60 * 1000;
  const inTournamentWindow = (kickoffAt: Date | null | undefined) => {
    if (!kickoffAt || medianKick == null) return false;
    return Math.abs(kickoffAt.getTime() - medianKick) <= WINDOW_MS;
  };

  const tournament = inYear.filter((f) => inTournamentWindow(f.kickoffAt));
  const outside = real.filter((f) => !tournament.some((t) => t.id === f.id));

  const knockouts = tournament.filter((f) => isWorldCupKnockoutStage(f.stage, f.round));
  const pool = tournament
    .filter((f) => !isWorldCupKnockoutStage(f.stage, f.round))
    .filter((f) => f.kickoffAt)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());

  const firstPoolKick = pool[0]?.kickoffAt?.getTime() ?? null;
  const updates: Array<{ id: string; round: string | null }> = [];

  for (const fx of pool) {
    if (firstPoolKick == null || !fx.kickoffAt) continue;
    const days = Math.max(0, (fx.kickoffAt.getTime() - firstPoolKick) / (1000 * 60 * 60 * 24));
    const roundNum = Math.max(1, Math.floor(days / 7) + 1);
    updates.push({ id: fx.id, round: `Round ${roundNum}` });
  }

  for (const fx of knockouts) {
    const label = knockoutRoundLabel(fx.stage, fx.round) ?? "Final";
    updates.push({ id: fx.id, round: label });
  }

  for (const fx of outside) {
    if ((fx.round ?? "").trim()) updates.push({ id: fx.id, round: null });
  }

  let updated = 0;
  for (const u of updates) {
    const current = real.find((f) => f.id === u.id);
    const cur = (current?.round ?? "").trim() || null;
    const next = u.round?.trim() || null;
    if (cur === next) continue;
    if (dryRun) {
      updated += 1;
      continue;
    }
    await db.update(fixtures).set({ round: next }).where(eq(fixtures.id, u.id));
    updated += 1;
  }

  const poolRoundCount = new Set(
    updates.filter((u) => (u.round ?? "").startsWith("Round ")).map((u) => u.round),
  ).size;

  return {
    scanned: real.length,
    updated,
    poolRounds: poolRoundCount,
    knockouts: knockouts.length,
  };
}

async function rateSeasonFixtures(input: {
  seasonId: string;
  competitionId: string;
}): Promise<{ fixtures: number; rated: number; players: number; failed: number }> {
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      externalMatchId: fixtures.externalMatchId,
      slug: fixtures.slug,
    })
    .from(fixtures)
    .where(
      and(eq(fixtures.seasonId, input.seasonId), eq(fixtures.competitionId, input.competitionId)),
    );

  const targets = rows.filter(
    (r) => isFixtureRatingsPublished(r.status) && !isSeedFixture(r.externalMatchId),
  );

  let rated = 0;
  let players = 0;
  let failed = 0;

  await mapPool(targets, concurrency, async (row, index) => {
    if (dryRun) {
      rated += 1;
      return;
    }
    try {
      const result = await calculateAndPersistFixtureMatchRatings(row.id);
      rated += 1;
      players += result.calculated;
      if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
        console.log(
          `    ratings [${index + 1}/${targets.length}] ${row.slug ?? row.externalMatchId} · ${result.calculated} players`,
        );
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `    ✗ rating ${row.slug ?? row.externalMatchId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  });

  return { fixtures: targets.length, rated, players, failed };
}

async function generateOne(input: {
  competitionId: string;
  seasonId: string;
  roundKey: string;
  label: string;
  forceProvisional?: boolean;
}): Promise<"generated" | "published" | "skipped" | "failed"> {
  if (dryRun) {
    console.log(`    dry-run generate ${input.label} (${input.roundKey})`);
    return "generated";
  }
  try {
    const result = await generateTeamOfWeek({
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      roundKey: input.roundKey,
      forceProvisional: input.forceProvisional,
    });
    console.log(
      `    generated ${input.label} → xv=${result.startingCount}${
        result.provisional ? " provisional" : ""
      }`,
    );
    if (publish) {
      await publishTeamOfWeekEdition(result.editionId);
      console.log(`    published ${input.label}`);
      return "published";
    }
    return "generated";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/published\/locked/i.test(msg)) {
      console.log(`    skip ${input.label}: ${msg}`);
      return "skipped";
    }
    console.warn(`    ✗ ${input.label}: ${msg}`);
    return "failed";
  }
}

async function generateSeasonTotw(input: {
  seasonId: string;
  competitionId: string;
  year: number;
}): Promise<{ rounds: number; generated: number; published: number; failed: number }> {
  const rounds = await listRoundsForSeason({
    competitionId: input.competitionId,
    seasonId: input.seasonId,
  });

  let generated = 0;
  let publishedCount = 0;
  let failed = 0;

  for (const round of rounds) {
    if (round.completedCount < 1) {
      console.log(`    skip ${round.roundKey}: no completed fixtures`);
      continue;
    }
    if (round.ratedPlayerCount < 8) {
      console.log(
        `    skip ${round.roundKey}: only ${round.ratedPlayerCount} rated players (need ≥8)`,
      );
      continue;
    }
    if (round.editionStatus === "published" || round.editionStatus === "locked") {
      console.log(`    skip ${round.roundKey}: already ${round.editionStatus}`);
      continue;
    }

    const status = await generateOne({
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      roundKey: round.roundKey,
      label: round.roundName,
      forceProvisional: round.completedCount < round.fixtureCount,
    });
    if (status === "generated") generated += 1;
    else if (status === "published") {
      generated += 1;
      publishedCount += 1;
    } else if (status === "failed") failed += 1;
  }

  // Team of the Tournament — all completed fixtures.
  const tournamentStatus = await generateOne({
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    roundKey: TOURNAMENT_ROUND_KEY,
    label: "Team of the Tournament",
    forceProvisional: false,
  });
  if (tournamentStatus === "generated") generated += 1;
  else if (tournamentStatus === "published") {
    generated += 1;
    publishedCount += 1;
  } else if (tournamentStatus === "failed") failed += 1;

  return {
    rounds: rounds.length + 1,
    generated,
    published: publishedCount,
    failed,
  };
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
    .filter((s) => s.year != null && onlyYears.includes(s.year))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  console.log(
    `RWC Team of the Week backfill (${selected.map((s) => s.year).join(", ") || "none"})${
      dryRun ? " [dry-run]" : ""
    }${publish ? " [publish]" : ""}`,
  );
  console.log("Round model: Round N (pool weeks) → Quarter/Semi/Bronze/Final → Team of the Tournament");

  for (const season of selected) {
    console.log(`\n▶ ${season.year}`);

    if (!skipRoundRepair) {
      const repair = await repairRoundsForSeason({
        seasonId: season.id,
        year: season.year!,
      });
      console.log(
        `  rounds rewritten: ${repair.updated}/${repair.scanned} (pool weeks=${repair.poolRounds}, knockout fixtures=${repair.knockouts})`,
      );
    }

    // Skip seasons with no completed fixtures (e.g. 2027).
    const completed = await db
      .select({ id: fixtures.id, status: fixtures.status, externalMatchId: fixtures.externalMatchId })
      .from(fixtures)
      .where(
        and(eq(fixtures.seasonId, season.id), eq(fixtures.competitionId, competition.id)),
      );
    const completedCount = completed.filter(
      (f) => isFixtureRatingsPublished(f.status) && !isSeedFixture(f.externalMatchId),
    ).length;
    if (completedCount < 1) {
      console.log(`  skip season: no completed fixtures`);
      continue;
    }

    if (!skipRatings) {
      const ratings = await rateSeasonFixtures({
        seasonId: season.id,
        competitionId: competition.id,
      });
      console.log(
        `  ratings: fixtures=${ratings.fixtures} ok=${ratings.rated} players=${ratings.players} failed=${ratings.failed}`,
      );
    }

    const totw = await generateSeasonTotw({
      seasonId: season.id,
      competitionId: competition.id,
      year: season.year!,
    });
    console.log(
      `  totw: targets=${totw.rounds} generated=${totw.generated} published=${totw.published} failed=${totw.failed}`,
    );
  }

  console.log("\nDone. Public: /competitions/rugby-world-cup/team-of-the-week");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
