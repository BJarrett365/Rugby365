/**
 * Apply World Rugby points-exchange after completed international fixtures
 * and persist a calculated rankings snapshot.
 */
import { asc, eq, inArray } from "drizzle-orm";
import {
  applyMatchToTeamRatings,
  type WorldRugbyRankingCategory,
} from "@rugby365/import-sdk";
import {
  competitions,
  fixtures,
  teams,
  worldRankingFeeds,
  worldRankingRows,
  worldRankingSnapshots,
} from "@rugby365/db";
import { getDb } from "./db";
import { getNearestWorldRankingSnapshot } from "./world-rugby-rankings-at-date";

export const RUGBY365_CALC_PROVIDER = "rugby365_calc";

const COMPLETED = ["full_time", "completed", "ft", "final", "result"] as const;

function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return COMPLETED.some((x) => s.includes(x)) || s === "full_time";
}

export type ApplyFixtureRankingResult =
  | {
      applied: true;
      category: WorldRugbyRankingCategory;
      effectiveDate: string;
      snapshotId: string;
      homeDelta: number;
      awayDelta: number;
      noExchange: boolean;
    }
  | {
      applied: false;
      reason: string;
    };

/**
 * If the fixture is a completed full international between ranked nations,
 * apply the WR points exchange and store a calculated snapshot.
 */
export async function applyWorldRankingForFixture(
  fixtureId: string,
  options: { category?: WorldRugbyRankingCategory; force?: boolean } = {},
): Promise<ApplyFixtureRankingResult> {
  const db = getDb();
  const category = options.category ?? "mru";

  const [fixture] = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      kickoffAt: fixtures.kickoffAt,
      isNeutralVenue: fixtures.isNeutralVenue,
      competitionId: fixtures.competitionId,
      competitionName: fixtures.competitionName,
      competitionType: competitions.competitionType,
      competitionSlug: competitions.slug,
    })
    .from(fixtures)
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  if (!fixture) return { applied: false, reason: "fixture_not_found" };
  if (!isCompletedStatus(fixture.status) && !options.force) {
    return { applied: false, reason: "fixture_not_completed" };
  }
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    return { applied: false, reason: "missing_teams" };
  }

  const competitionType = (fixture.competitionType ?? "").toLowerCase();
  const slug = (fixture.competitionSlug ?? "").toLowerCase();
  const name = (fixture.competitionName ?? "").toLowerCase();
  const isInternational =
    competitionType === "international" ||
    competitionType === "world_cup" ||
    slug.includes("six-nations") ||
    slug.includes("rugby-championship") ||
    slug.includes("world-cup") ||
    name.includes("six nations") ||
    name.includes("rugby championship") ||
    name.includes("world cup");

  if (!isInternational) {
    return { applied: false, reason: "not_international" };
  }

  const isWorldCup =
    competitionType === "world_cup" ||
    slug.includes("world-cup") ||
    name.includes("world cup");

  const effectiveDate = toDateOnly(fixture.kickoffAt);

  const baseSnap = await getNearestWorldRankingSnapshot(category, effectiveDate);
  if (!baseSnap) {
    return { applied: false, reason: "no_base_snapshot" };
  }

  const baseRows = await db
    .select()
    .from(worldRankingRows)
    .where(eq(worldRankingRows.snapshotId, baseSnap.id))
    .orderBy(asc(worldRankingRows.position));

  if (!baseRows.length) {
    return { applied: false, reason: "empty_base_snapshot" };
  }

  const homeRow = baseRows.find((r) => r.teamId === fixture.homeTeamId);
  const awayRow = baseRows.find((r) => r.teamId === fixture.awayTeamId);
  if (!homeRow || !awayRow) {
    return { applied: false, reason: "teams_not_in_rankings" };
  }

  const { ratings, exchange } = applyMatchToTeamRatings(
    baseRows.map((r) => ({
      teamKey: r.worldRugbyTeamId,
      teamName: r.teamName,
      points: r.points,
      position: r.position,
    })),
    {
      homeKey: homeRow.worldRugbyTeamId,
      awayKey: awayRow.worldRugbyTeamId,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      neutralVenue: fixture.isNeutralVenue,
      isWorldCup,
    },
  );

  const notes = `Calculated from fixture ${fixtureId} (base ${baseSnap.effectiveDate} / ${baseSnap.sourceProvider})`;

  const [snapshot] = await db
    .insert(worldRankingSnapshots)
    .values({
      category,
      effectiveDate,
      sourceProvider: RUGBY365_CALC_PROVIDER,
      sourceUrl: null,
      notes,
    })
    .onConflictDoUpdate({
      target: [
        worldRankingSnapshots.category,
        worldRankingSnapshots.effectiveDate,
        worldRankingSnapshots.sourceProvider,
      ],
      set: { createdAt: new Date(), notes },
    })
    .returning();

  await db.delete(worldRankingRows).where(eq(worldRankingRows.snapshotId, snapshot.id));

  const byKey = new Map(baseRows.map((r) => [r.worldRugbyTeamId, r]));
  for (const rating of ratings) {
    const prev = byKey.get(rating.teamKey);
    await db.insert(worldRankingRows).values({
      snapshotId: snapshot.id,
      worldRugbyTeamId: rating.teamKey,
      position: rating.position ?? 0,
      previousPosition: rating.previousPosition ?? prev?.position ?? null,
      points: rating.points,
      previousPoints: rating.previousPoints ?? prev?.points ?? null,
      teamName: rating.teamName,
      teamAbbreviation: prev?.teamAbbreviation ?? null,
      countryCode: prev?.countryCode ?? null,
      teamId: prev?.teamId ?? null,
    });
  }

  // Promote calculated snapshot as current when it is on/after feed date
  const [feed] = await db
    .select()
    .from(worldRankingFeeds)
    .where(eq(worldRankingFeeds.category, category))
    .limit(1);

  let promote = !feed?.currentSnapshotId;
  if (feed?.currentSnapshotId) {
    const [current] = await db
      .select({ effectiveDate: worldRankingSnapshots.effectiveDate })
      .from(worldRankingSnapshots)
      .where(eq(worldRankingSnapshots.id, feed.currentSnapshotId))
      .limit(1);
    const currentDate = current?.effectiveDate
      ? String(current.effectiveDate).slice(0, 10)
      : null;
    promote = !currentDate || effectiveDate >= currentDate;
  }

  if (promote) {
    await db
      .insert(worldRankingFeeds)
      .values({
        category,
        label: category === "mru" ? "Men's Rugby Union" : "Women's Rugby Union",
        sourceUrl: "rugby365:calculated",
        currentSnapshotId: snapshot.id,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: worldRankingFeeds.category,
        set: {
          currentSnapshotId: snapshot.id,
          syncedAt: new Date(),
        },
      });
  }

  return {
    applied: true,
    category,
    effectiveDate,
    snapshotId: snapshot.id,
    homeDelta: exchange.homeDelta,
    awayDelta: exchange.awayDelta,
    noExchange: exchange.noExchange,
  };
}

export async function previewWorldRankingExchange(input: {
  category?: WorldRugbyRankingCategory;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  asOf?: string;
  neutralVenue?: boolean;
  isWorldCup?: boolean;
}) {
  const category = input.category ?? "mru";
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const baseSnap = await getNearestWorldRankingSnapshot(category, asOf);
  if (!baseSnap) return { ok: false as const, reason: "no_base_snapshot" };

  const db = getDb();
  const baseRows = await db
    .select()
    .from(worldRankingRows)
    .where(eq(worldRankingRows.snapshotId, baseSnap.id));

  const homeRow = baseRows.find((r) => r.teamId === input.homeTeamId);
  const awayRow = baseRows.find((r) => r.teamId === input.awayTeamId);
  if (!homeRow || !awayRow) {
    return { ok: false as const, reason: "teams_not_in_rankings" };
  }

  const { ratings, exchange } = applyMatchToTeamRatings(
    baseRows.map((r) => ({
      teamKey: r.worldRugbyTeamId,
      teamName: r.teamName,
      points: r.points,
      position: r.position,
    })),
    {
      homeKey: homeRow.worldRugbyTeamId,
      awayKey: awayRow.worldRugbyTeamId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      neutralVenue: input.neutralVenue,
      isWorldCup: input.isWorldCup,
    },
  );

  const teamIds = [input.homeTeamId, input.awayTeamId];
  const teamRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, teamIds));
  const nameById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  return {
    ok: true as const,
    baseEffectiveDate: baseSnap.effectiveDate,
    baseSourceProvider: baseSnap.sourceProvider,
    exchange,
    home: {
      teamId: input.homeTeamId,
      teamName: nameById[input.homeTeamId] ?? homeRow.teamName,
      before: homeRow.points,
      after: ratings.find((r) => r.teamKey === homeRow.worldRugbyTeamId)?.points ?? null,
      positionBefore: homeRow.position,
      positionAfter:
        ratings.find((r) => r.teamKey === homeRow.worldRugbyTeamId)?.position ?? null,
    },
    away: {
      teamId: input.awayTeamId,
      teamName: nameById[input.awayTeamId] ?? awayRow.teamName,
      before: awayRow.points,
      after: ratings.find((r) => r.teamKey === awayRow.worldRugbyTeamId)?.points ?? null,
      positionBefore: awayRow.position,
      positionAfter:
        ratings.find((r) => r.teamKey === awayRow.worldRugbyTeamId)?.position ?? null,
    },
  };
}

/** Soft hook from match completion cascade — never throws. */
export async function tryApplyWorldRankingAfterMatch(fixtureId: string): Promise<void> {
  try {
    await applyWorldRankingForFixture(fixtureId);
  } catch {
    /* non-blocking */
  }
}
