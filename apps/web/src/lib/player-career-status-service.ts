import { desc, eq, sql } from "drizzle-orm";
import { playerLegends, playerTransfers, players } from "@rugby365/db";
import { getDb } from "./db";
import { getPlayerLegends } from "./legend-admin-service";
import {
  movementTypeToCareerStatus,
  normalizePlayerCareerStatus,
  type PlayerCareerStatus,
} from "./player-career-status";
import type { TransferMovementType } from "./transfer-types";

export async function resolvePlayerCareerStatus(playerId: string): Promise<PlayerCareerStatus> {
  const legends = await getPlayerLegends(playerId);
  if (legends.some((row) => row.legendStatus === "active")) {
    return "legend";
  }

  const db = getDb();
  const [latestTransfer] = await db
    .select({ movementType: playerTransfers.movementType })
    .from(playerTransfers)
    .where(eq(playerTransfers.playerId, playerId))
    .orderBy(desc(playerTransfers.effectiveDate), desc(playerTransfers.createdAt))
    .limit(1);

  const fromTransfer = movementTypeToCareerStatus(
    latestTransfer?.movementType as TransferMovementType | undefined,
  );
  if (fromTransfer === "released" || fromTransfer === "retired") {
    return fromTransfer;
  }

  const [player] = await db
    .select({ clubTeamId: players.clubTeamId, clubName: players.clubName })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (player?.clubTeamId || player?.clubName?.trim()) {
    return "active";
  }

  return fromTransfer ?? "active";
}

export async function applyPlayerCareerStatus(
  playerId: string,
  status: PlayerCareerStatus,
): Promise<void> {
  const db = getDb();
  await db
    .update(players)
    .set({ careerStatus: normalizePlayerCareerStatus(status) })
    .where(eq(players.id, playerId));
}

export async function reconcilePlayerCareerStatus(playerId: string): Promise<PlayerCareerStatus> {
  const status = await resolvePlayerCareerStatus(playerId);
  await applyPlayerCareerStatus(playerId, status);
  return status;
}

export async function reconcileAllPlayerCareerStatuses(): Promise<{
  updated: number;
  total: number;
  byStatus: Record<PlayerCareerStatus, number>;
}> {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      careerStatus: players.careerStatus,
      clubTeamId: players.clubTeamId,
      clubName: players.clubName,
    })
    .from(players);

  const legendRows = await db
    .select({ playerId: playerLegends.playerId })
    .from(playerLegends)
    .where(eq(playerLegends.legendStatus, "active"));
  const legendPlayerIds = new Set(legendRows.map((row) => row.playerId));

  const latestTransferRows = await db.execute<{
    player_id: string;
    movement_type: string;
  }>(sql`
    SELECT DISTINCT ON (${playerTransfers.playerId})
      ${playerTransfers.playerId} AS player_id,
      ${playerTransfers.movementType} AS movement_type
    FROM ${playerTransfers}
    ORDER BY ${playerTransfers.playerId}, ${playerTransfers.effectiveDate} DESC NULLS LAST, ${playerTransfers.createdAt} DESC
  `);

  const latestTransferByPlayer = new Map<string, string>();
  for (const row of latestTransferRows) {
    latestTransferByPlayer.set(row.player_id, row.movement_type);
  }

  const byStatus: Record<PlayerCareerStatus, number> = {
    active: 0,
    released: 0,
    retired: 0,
    legend: 0,
  };

  let updated = 0;
  for (const row of rows) {
    let next: PlayerCareerStatus = "active";
    if (legendPlayerIds.has(row.id)) {
      next = "legend";
    } else {
      const fromTransfer = movementTypeToCareerStatus(
        latestTransferByPlayer.get(row.id) as TransferMovementType | undefined,
      );
      if (fromTransfer === "released" || fromTransfer === "retired") {
        next = fromTransfer;
      } else if (row.clubTeamId || row.clubName?.trim()) {
        next = "active";
      } else {
        next = fromTransfer ?? "active";
      }
    }

    byStatus[next] += 1;
    if (row.careerStatus !== next) {
      await db.update(players).set({ careerStatus: next }).where(eq(players.id, row.id));
      updated += 1;
    }
  }

  return { updated, total: rows.length, byStatus };
}

export async function syncLegendPlayerCareerStatuses(): Promise<number> {
  const db = getDb();
  const legendRows = await db
    .select({ playerId: playerLegends.playerId })
    .from(playerLegends)
    .where(eq(playerLegends.legendStatus, "active"));

  let updated = 0;
  for (const row of legendRows) {
    const [player] = await db
      .select({ careerStatus: players.careerStatus })
      .from(players)
      .where(eq(players.id, row.playerId))
      .limit(1);
    if (player?.careerStatus !== "legend") {
      await applyPlayerCareerStatus(row.playerId, "legend");
      updated += 1;
    }
  }
  return updated;
}
