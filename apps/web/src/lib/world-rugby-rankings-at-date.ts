/**
 * World Rugby ranking lookup at a historical date.
 * Never substitutes today's ranking. Rejects API clamp-forward responses.
 */
import { and, desc, eq, lte, sql } from "drizzle-orm";
import {
  worldRankingFeeds,
  worldRankingRows,
  worldRankingSnapshots,
} from "@rugby365/db";
import {
  fetchWorldRugbyRankings,
  type WorldRugbyRankingCategory,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import { upsertWorldRugbyRankingsForDate } from "./world-rugby-rankings-service";

export type TeamRankingAtDate = {
  teamId: string;
  position: number;
  points: number;
  teamName: string;
  snapshotId: string;
  effectiveDate: string;
  category: string;
};

function toDateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Nearest stored snapshot on or before date for category.
 * Prefers official World Rugby, then calculated, then Wikipedia.
 */
export async function getNearestWorldRankingSnapshot(
  category: WorldRugbyRankingCategory | string,
  asOf: Date | string,
): Promise<{ id: string; effectiveDate: string; category: string; sourceProvider: string } | null> {
  const db = getDb();
  const date = toDateOnly(asOf);
  const snaps = await db
    .select({
      id: worldRankingSnapshots.id,
      effectiveDate: worldRankingSnapshots.effectiveDate,
      category: worldRankingSnapshots.category,
      sourceProvider: worldRankingSnapshots.sourceProvider,
    })
    .from(worldRankingSnapshots)
    .where(
      and(
        eq(worldRankingSnapshots.category, category),
        lte(worldRankingSnapshots.effectiveDate, date),
      ),
    )
    .orderBy(desc(worldRankingSnapshots.effectiveDate))
    .limit(12);

  if (!snaps.length) return null;

  const latestDate = String(snaps[0].effectiveDate).slice(0, 10);
  const sameDate = snaps.filter((s) => String(s.effectiveDate).slice(0, 10) === latestDate);
  const preference = ["world_rugby", "rugby365_calc", "wikipedia", "manual"];
  sameDate.sort(
    (a, b) =>
      preference.indexOf(a.sourceProvider) - preference.indexOf(b.sourceProvider),
  );
  const snap = sameDate[0];
  return {
    id: snap.id,
    effectiveDate: String(snap.effectiveDate).slice(0, 10),
    category: snap.category,
    sourceProvider: snap.sourceProvider,
  };
}

export async function getTeamRankingAtDate(input: {
  teamId: string;
  asOf: Date | string;
  category?: WorldRugbyRankingCategory | string;
}): Promise<TeamRankingAtDate | null> {
  const category = input.category ?? "mru";
  const snap = await getNearestWorldRankingSnapshot(category, input.asOf);
  if (!snap) return null;
  const db = getDb();
  const [row] = await db
    .select({
      position: worldRankingRows.position,
      points: worldRankingRows.points,
      teamName: worldRankingRows.teamName,
    })
    .from(worldRankingRows)
    .where(
      and(eq(worldRankingRows.snapshotId, snap.id), eq(worldRankingRows.teamId, input.teamId)),
    )
    .limit(1);
  if (!row) return null;
  return {
    teamId: input.teamId,
    position: row.position,
    points: row.points,
    teamName: row.teamName,
    snapshotId: snap.id,
    effectiveDate: snap.effectiveDate,
    category: snap.category,
  };
}

/**
 * Fetch + store a dated World Rugby snapshot when the API returns an effective
 * date on/before the requested date (rejects clamp-forward).
 */
export async function syncWorldRugbyRankingsForDate(
  category: WorldRugbyRankingCategory,
  requestedDate: string,
): Promise<{ ok: boolean; effectiveDate: string | null; reason?: string; rowsUpserted?: number }> {
  const payload = await fetchWorldRugbyRankings(category, { date: requestedDate });
  const effective = payload.effectiveDate.slice(0, 10);
  const requested = requestedDate.slice(0, 10);
  if (effective > requested) {
    return {
      ok: false,
      effectiveDate: effective,
      reason: `API clamped to ${effective} (after requested ${requested}) — not stored as historic.`,
    };
  }
  const result = await upsertWorldRugbyRankingsForDate(payload);
  return { ok: true, effectiveDate: result.effectiveDate, rowsUpserted: result.rowsUpserted };
}

/** Count eligible matches that have coach-team ranking on/before kickoff. */
export async function countMatchesWithTeamRankingAtDate(
  matches: Array<{ teamId: string | null; kickoffAt: Date | null; opponentTeamId?: string | null }>,
  options: { requireOpponent?: boolean; category?: string } = {},
): Promise<number> {
  const category = options.category ?? "mru";
  let have = 0;
  for (const m of matches) {
    if (!m.teamId || !m.kickoffAt) continue;
    const team = await getTeamRankingAtDate({
      teamId: m.teamId,
      asOf: m.kickoffAt,
      category,
    });
    if (!team) continue;
    if (options.requireOpponent && m.opponentTeamId) {
      const opp = await getTeamRankingAtDate({
        teamId: m.opponentTeamId,
        asOf: m.kickoffAt,
        category,
      });
      if (!opp) continue;
    }
    have += 1;
  }
  return have;
}

export async function listStoredRankingSnapshotDates(
  category: string = "mru",
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ d: worldRankingSnapshots.effectiveDate })
    .from(worldRankingSnapshots)
    .where(eq(worldRankingSnapshots.category, category))
    .orderBy(desc(worldRankingSnapshots.effectiveDate));
  return rows.map((r) => String(r.d).slice(0, 10));
}

/** Soft check feeds table exists / has current pointer. */
export async function rankingFeedSyncedAt(category: string = "mru"): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ syncedAt: worldRankingFeeds.syncedAt })
    .from(worldRankingFeeds)
    .where(eq(worldRankingFeeds.category, category))
    .limit(1);
  return row?.syncedAt?.toISOString() ?? null;
}

export async function countWorldRankingSnapshots(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(worldRankingSnapshots);
  return row?.n ?? 0;
}
