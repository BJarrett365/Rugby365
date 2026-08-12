import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  fetchWikipediaWorldRankings,
  type WorldRugbyRankingCategory,
} from "@rugby365/import-sdk";
import {
  worldRankingLeaderSpans,
  worldRankingRows,
  worldRankingSnapshots,
  worldRankingTeamMilestones,
} from "@rugby365/db";
import { getDb } from "./db";
import { resolveTeam } from "./entity-resolve-service";

export const WIKIPEDIA_RANKINGS_PROVIDER = "wikipedia";

export type WikipediaWorldRankingsImportResult = {
  category: WorldRugbyRankingCategory;
  asOfDate: string | null;
  currentRowsUpserted: number;
  leaderSpansUpserted: number;
  milestonesUpserted: number;
  sourceUrl: string;
};

function wikiTeamExternalId(category: WorldRugbyRankingCategory, codeOrName: string): string {
  const key = codeOrName.trim().toLowerCase().replace(/\s+/g, "-");
  return `wiki:${category}:${key}`;
}

async function resolveNationTeam(input: {
  category: WorldRugbyRankingCategory;
  teamName: string;
  teamCode: string | null;
}): Promise<{ id: string } | null> {
  const externalProviderId = wikiTeamExternalId(
    input.category,
    input.teamCode ?? input.teamName,
  );
  return resolveTeam({
    name: input.teamName,
    externalProviderId,
    sourceProvider: WIKIPEDIA_RANKINGS_PROVIDER,
    createIfMissing: true,
  });
}

/**
 * Import Wikipedia World Rugby Rankings page:
 * - current top table as a dated snapshot (source=wikipedia)
 * - #1 leader spans
 * - best/worst rank + peak/trough points milestones
 */
export async function importWikipediaWorldRankings(
  category: WorldRugbyRankingCategory = "mru",
): Promise<WikipediaWorldRankingsImportResult> {
  const parsed = await fetchWikipediaWorldRankings({ category });
  const db = getDb();
  const importedAt = new Date();
  const sourceUrl = parsed.sourceUrl;

  let currentRowsUpserted = 0;
  if (parsed.currentTable.length && parsed.asOfDate) {
    const [snapshot] = await db
      .insert(worldRankingSnapshots)
      .values({
        category,
        effectiveDate: parsed.asOfDate,
        sourceProvider: WIKIPEDIA_RANKINGS_PROVIDER,
        sourceUrl,
        notes: `Imported from ${parsed.pageTitle}`,
      })
      .onConflictDoUpdate({
        target: [
          worldRankingSnapshots.category,
          worldRankingSnapshots.effectiveDate,
          worldRankingSnapshots.sourceProvider,
        ],
        set: {
          sourceUrl,
          notes: `Imported from ${parsed.pageTitle}`,
          createdAt: importedAt,
        },
      })
      .returning();

    await db.delete(worldRankingRows).where(eq(worldRankingRows.snapshotId, snapshot.id));

    for (const entry of parsed.currentTable) {
      const team = await resolveNationTeam({
        category,
        teamName: entry.teamName,
        teamCode: entry.teamCode,
      });
      const previousPosition =
        entry.change == null ? null : entry.position + entry.change;

      await db.insert(worldRankingRows).values({
        snapshotId: snapshot.id,
        worldRugbyTeamId: wikiTeamExternalId(category, entry.teamCode ?? entry.teamName),
        position: entry.position,
        previousPosition,
        points: entry.points,
        previousPoints: null,
        teamName: entry.teamName,
        teamAbbreviation: entry.teamCode,
        countryCode: entry.teamCode,
        teamId: team?.id ?? null,
      });
      currentRowsUpserted += 1;
    }
  }

  let leaderSpansUpserted = 0;
  for (const span of parsed.leaderSpans) {
    const team = await resolveNationTeam({
      category,
      teamName: span.teamName,
      teamCode: span.teamCode,
    });
    await db
      .insert(worldRankingLeaderSpans)
      .values({
        category,
        teamName: span.teamName,
        teamCode: span.teamCode,
        teamId: team?.id ?? null,
        startDate: span.startDate,
        endDate: span.endDate,
        weeks: span.weeks,
        totalWeeks: span.totalWeeks,
        reignIndex: span.reignIndex,
        sourceProvider: WIKIPEDIA_RANKINGS_PROVIDER,
        sourceUrl,
        importedAt,
      })
      .onConflictDoUpdate({
        target: [
          worldRankingLeaderSpans.category,
          worldRankingLeaderSpans.startDate,
          worldRankingLeaderSpans.teamName,
        ],
        set: {
          teamCode: span.teamCode,
          teamId: team?.id ?? null,
          endDate: span.endDate,
          weeks: span.weeks,
          totalWeeks: span.totalWeeks,
          reignIndex: span.reignIndex,
          sourceUrl,
          importedAt,
        },
      });
    leaderSpansUpserted += 1;
  }

  let milestonesUpserted = 0;

  async function upsertMilestone(input: {
    teamName: string;
    teamCode: string | null;
    milestoneType: string;
    rank?: number | null;
    points?: number | null;
    yearLabel?: string | null;
    achievedOn?: string | null;
  }) {
    const team = await resolveNationTeam({
      category,
      teamName: input.teamName,
      teamCode: input.teamCode,
    });
    await db
      .insert(worldRankingTeamMilestones)
      .values({
        category,
        teamName: input.teamName,
        teamCode: input.teamCode,
        teamId: team?.id ?? null,
        milestoneType: input.milestoneType,
        rank: input.rank ?? null,
        points: input.points ?? null,
        yearLabel: input.yearLabel ?? null,
        achievedOn: input.achievedOn ?? null,
        sourceProvider: WIKIPEDIA_RANKINGS_PROVIDER,
        sourceUrl,
        importedAt,
      })
      .onConflictDoUpdate({
        target: [
          worldRankingTeamMilestones.category,
          worldRankingTeamMilestones.teamName,
          worldRankingTeamMilestones.milestoneType,
        ],
        set: {
          teamCode: input.teamCode,
          teamId: team?.id ?? null,
          rank: input.rank ?? null,
          points: input.points ?? null,
          yearLabel: input.yearLabel ?? null,
          achievedOn: input.achievedOn ?? null,
          sourceUrl,
          importedAt,
        },
      });
    milestonesUpserted += 1;
  }

  for (const row of parsed.rankMilestones) {
    await upsertMilestone({
      teamName: row.teamName,
      teamCode: row.teamCode,
      milestoneType: "best_rank",
      rank: row.bestRank,
      yearLabel: row.bestYears,
    });
    await upsertMilestone({
      teamName: row.teamName,
      teamCode: row.teamCode,
      milestoneType: "worst_rank",
      rank: row.worstRank,
      yearLabel: row.worstYears,
    });
  }

  for (const row of parsed.pointsMilestones) {
    await upsertMilestone({
      teamName: row.teamName,
      teamCode: row.teamCode,
      milestoneType: "peak_points",
      points: row.peakPoints,
      achievedOn: row.peakDate,
    });
    await upsertMilestone({
      teamName: row.teamName,
      teamCode: row.teamCode,
      milestoneType: "trough_points",
      points: row.troughPoints,
      achievedOn: row.troughDate,
    });
  }

  return {
    category,
    asOfDate: parsed.asOfDate,
    currentRowsUpserted,
    leaderSpansUpserted,
    milestonesUpserted,
    sourceUrl,
  };
}

export async function listWorldRankingLeaderSpans(
  category: WorldRugbyRankingCategory | string = "mru",
) {
  const db = getDb();
  return db
    .select()
    .from(worldRankingLeaderSpans)
    .where(eq(worldRankingLeaderSpans.category, category))
    .orderBy(asc(worldRankingLeaderSpans.startDate));
}

export async function listWorldRankingMilestones(
  category: WorldRugbyRankingCategory | string = "mru",
) {
  const db = getDb();
  return db
    .select()
    .from(worldRankingTeamMilestones)
    .where(eq(worldRankingTeamMilestones.category, category))
    .orderBy(asc(worldRankingTeamMilestones.teamName), asc(worldRankingTeamMilestones.milestoneType));
}

export async function listWorldRankingSnapshotMeta(
  category: WorldRugbyRankingCategory | string = "mru",
  limit = 50,
) {
  const db = getDb();
  const snaps = await db
    .select({
      id: worldRankingSnapshots.id,
      category: worldRankingSnapshots.category,
      effectiveDate: worldRankingSnapshots.effectiveDate,
      sourceProvider: worldRankingSnapshots.sourceProvider,
      sourceUrl: worldRankingSnapshots.sourceUrl,
      notes: worldRankingSnapshots.notes,
      createdAt: worldRankingSnapshots.createdAt,
      rowCount: sql<number>`(
        select count(*)::int from ${worldRankingRows}
        where ${worldRankingRows.snapshotId} = ${worldRankingSnapshots.id}
      )`,
    })
    .from(worldRankingSnapshots)
    .where(eq(worldRankingSnapshots.category, category))
    .orderBy(desc(worldRankingSnapshots.effectiveDate), desc(worldRankingSnapshots.createdAt))
    .limit(limit);

  return snaps.map((s) => ({
    ...s,
    effectiveDate: String(s.effectiveDate).slice(0, 10),
    createdAt: s.createdAt?.toISOString() ?? null,
  }));
}

export async function getWorldRankingSnapshotDetail(snapshotId: string) {
  const db = getDb();
  const [snap] = await db
    .select()
    .from(worldRankingSnapshots)
    .where(eq(worldRankingSnapshots.id, snapshotId))
    .limit(1);
  if (!snap) return null;

  const rows = await db
    .select()
    .from(worldRankingRows)
    .where(eq(worldRankingRows.snapshotId, snapshotId))
    .orderBy(asc(worldRankingRows.position));

  return {
    id: snap.id,
    category: snap.category,
    effectiveDate: String(snap.effectiveDate).slice(0, 10),
    sourceProvider: snap.sourceProvider,
    sourceUrl: snap.sourceUrl,
    notes: snap.notes,
    createdAt: snap.createdAt?.toISOString() ?? null,
    rows: rows.map((row) => ({
      position: row.position,
      previousPosition: row.previousPosition,
      points: row.points,
      previousPoints: row.previousPoints,
      movement:
        row.previousPosition == null ? null : row.previousPosition - row.position,
      pointsChange:
        row.previousPoints == null ? null : row.points - row.previousPoints,
      teamName: row.teamName,
      teamAbbreviation: row.teamAbbreviation,
      countryCode: row.countryCode,
      worldRugbyTeamId: row.worldRugbyTeamId,
      teamId: row.teamId,
    })),
  };
}

/** Who held #1 on a given date (from leader spans). */
export async function getWorldRankingLeaderAtDate(
  asOf: Date | string,
  category: WorldRugbyRankingCategory | string = "mru",
) {
  const db = getDb();
  const date = typeof asOf === "string" ? asOf.slice(0, 10) : asOf.toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(worldRankingLeaderSpans)
    .where(
      and(
        eq(worldRankingLeaderSpans.category, category),
        sql`${worldRankingLeaderSpans.startDate} <= ${date}`,
        sql`(${worldRankingLeaderSpans.endDate} is null or ${worldRankingLeaderSpans.endDate} >= ${date})`,
      ),
    )
    .orderBy(desc(worldRankingLeaderSpans.startDate))
    .limit(1);
  return row ?? null;
}
