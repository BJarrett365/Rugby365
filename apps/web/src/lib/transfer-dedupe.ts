/**
 * Semantic transfer dedupe — ignores wiki In/Out listing side.
 * Same player + season + from→to + movement = one transfer.
 */
import { and, eq, isNull } from "drizzle-orm";
import { playerTransfers, teams } from "@rugby365/db";
import { getDb } from "./db";
import { sanitizeTransferClub } from "./transfer-display";

export type TransferDedupeFields = {
  id: string;
  playerId: string;
  seasonId: string | null;
  movementType: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromClub: string | null;
  toClub: string | null;
  effectiveDate: Date | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  importKey: string | null;
  notes: string | null;
  positionName: string | null;
  createdAt?: Date | null;
};

export function normalizeClubKey(value: string | null | undefined): string {
  const cleaned = sanitizeTransferClub(value)?.toLowerCase().trim() ?? "";
  return cleaned.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "none";
}

/** Direction-agnostic key used while parsing wiki pages (no player UUID yet). */
export function buildWikiSemanticImportKey(input: {
  seasonLabel: string;
  playerName: string;
  fromClub: string | null;
  toClub: string | null;
  movementType: string;
}): string {
  const slug = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "none";
  return [
    slug(input.seasonLabel),
    slug(input.playerName),
    slug(input.fromClub ?? "none"),
    slug(input.toClub ?? "none"),
    input.movementType,
  ].join(":");
}

/**
 * Prefer resolved club names (from team id map when available) so In/Out
 * and team-id vs text-only rows collapse together.
 */
export function buildSemanticTransferKey(input: {
  playerId: string;
  seasonId?: string | null;
  movementType: string;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  fromClub?: string | null;
  toClub?: string | null;
  teamNameById?: Map<string, string>;
}): string {
  const resolve = (teamId: string | null | undefined, club: string | null | undefined) => {
    if (teamId && input.teamNameById?.get(teamId)) {
      return normalizeClubKey(input.teamNameById.get(teamId));
    }
    return normalizeClubKey(club);
  };
  return [
    input.playerId,
    input.seasonId ?? "none",
    input.movementType,
    resolve(input.fromTeamId, input.fromClub),
    resolve(input.toTeamId, input.toClub),
  ].join("|");
}

/** True when from and to resolve to the same club (no real move). */
export function isNoOpClubChange(input: {
  fromTeamId?: string | null;
  toTeamId?: string | null;
  fromClub?: string | null;
  toClub?: string | null;
  movementType?: string | null;
}): boolean {
  const movement = input.movementType ?? "permanent";
  if (
    movement === "released" ||
    movement === "retirement" ||
    movement === "contract_extension" ||
    movement === "academy_promotion"
  ) {
    return false;
  }
  if (input.fromTeamId && input.toTeamId) {
    return input.fromTeamId === input.toTeamId;
  }
  const from = normalizeClubKey(input.fromClub);
  const to = normalizeClubKey(input.toClub);
  if (from === "none" || to === "none") return false;
  return from === to;
}

export function scoreTransferKeeper(row: TransferDedupeFields): number {
  let score = 0;
  if (row.fromTeamId) score += 10;
  if (row.toTeamId) score += 10;
  if (row.fromTeamId && row.toTeamId) score += 5;
  if (row.sourceUrl?.trim()) score += 8;
  if (row.sourceProvider === "wikipedia") score += 4;
  if (row.effectiveDate) score += 6;
  if (row.importKey?.trim()) score += 3;
  if (row.notes?.trim()) score += 1;
  if (row.positionName?.trim()) score += 1;
  if (row.createdAt) {
    score += Math.max(0, 3 - Math.floor((Date.now() - row.createdAt.getTime()) / (86400000 * 30)));
  }
  return score;
}

export async function findSemanticDuplicateTransfer(input: {
  playerId: string;
  seasonId?: string | null;
  movementType: string;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  fromClub?: string | null;
  toClub?: string | null;
  excludeId?: string | null;
}): Promise<TransferDedupeFields | null> {
  const db = getDb();
  const conditions = [
    eq(playerTransfers.playerId, input.playerId),
    eq(playerTransfers.movementType, input.movementType),
  ];
  if (input.seasonId) conditions.push(eq(playerTransfers.seasonId, input.seasonId));
  else conditions.push(isNull(playerTransfers.seasonId));

  const rows = await db
    .select()
    .from(playerTransfers)
    .where(and(...conditions));

  const teamIds = [
    ...new Set(
      [...rows.flatMap((r) => [r.fromTeamId, r.toTeamId]), input.fromTeamId, input.toTeamId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
  const teamNameById = new Map<string, string>();
  if (teamIds.length) {
    const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
    for (const t of teamRows) {
      if (teamIds.includes(t.id)) teamNameById.set(t.id, t.name);
    }
  }

  const targetKey = buildSemanticTransferKey({ ...input, teamNameById });
  const matches = rows.filter((row) => {
    if (input.excludeId && row.id === input.excludeId) return false;
    return (
      buildSemanticTransferKey({
        playerId: row.playerId,
        seasonId: row.seasonId,
        movementType: row.movementType,
        fromTeamId: row.fromTeamId,
        toTeamId: row.toTeamId,
        fromClub: row.fromClub,
        toClub: row.toClub,
        teamNameById,
      }) === targetKey
    );
  });

  if (!matches.length) return null;
  matches.sort((a, b) => scoreTransferKeeper(b) - scoreTransferKeeper(a));
  const best = matches[0]!;
  return {
    id: best.id,
    playerId: best.playerId,
    seasonId: best.seasonId,
    movementType: best.movementType,
    fromTeamId: best.fromTeamId,
    toTeamId: best.toTeamId,
    fromClub: best.fromClub,
    toClub: best.toClub,
    effectiveDate: best.effectiveDate,
    sourceUrl: best.sourceUrl,
    sourceProvider: best.sourceProvider,
    importKey: best.importKey,
    notes: best.notes,
    positionName: best.positionName,
    createdAt: best.createdAt,
  };
}

export type TransferDedupeSummary = {
  groups: number;
  deleted: number;
  kept: number;
  details: Array<{ key: string; keptId: string; deletedIds: string[] }>;
};

/**
 * Remove duplicate transfer rows across all players, keeping the best record per semantic key.
 */
export async function dedupeAllPlayerTransfers(options?: {
  dryRun?: boolean;
}): Promise<TransferDedupeSummary> {
  const dryRun = options?.dryRun ?? false;
  const db = getDb();
  const [rows, allTeams] = await Promise.all([
    db.select().from(playerTransfers),
    db.select({ id: teams.id, name: teams.name }).from(teams),
  ]);
  const teamNameById = new Map(allTeams.map((t) => [t.id, t.name]));

  const groups = new Map<string, TransferDedupeFields[]>();
  for (const row of rows) {
    const key = buildSemanticTransferKey({
      playerId: row.playerId,
      seasonId: row.seasonId,
      movementType: row.movementType,
      fromTeamId: row.fromTeamId,
      toTeamId: row.toTeamId,
      fromClub: row.fromClub,
      toClub: row.toClub,
      teamNameById,
    });
    const list = groups.get(key) ?? [];
    list.push({
      id: row.id,
      playerId: row.playerId,
      seasonId: row.seasonId,
      movementType: row.movementType,
      fromTeamId: row.fromTeamId,
      toTeamId: row.toTeamId,
      fromClub: row.fromClub,
      toClub: row.toClub,
      effectiveDate: row.effectiveDate,
      sourceUrl: row.sourceUrl,
      sourceProvider: row.sourceProvider,
      importKey: row.importKey,
      notes: row.notes,
      positionName: row.positionName,
      createdAt: row.createdAt,
    });
    groups.set(key, list);
  }

  const summary: TransferDedupeSummary = {
    groups: 0,
    deleted: 0,
    kept: 0,
    details: [],
  };

  for (const [key, list] of groups) {
    // Drop permanent moves that never change club.
    const actionable = list.filter(
      (row) =>
        !isNoOpClubChange({
          fromTeamId: row.fromTeamId,
          toTeamId: row.toTeamId,
          fromClub: row.fromClub,
          toClub: row.toClub,
          movementType: row.movementType,
        }),
    );
    const noOps = list.filter((row) => !actionable.includes(row));
    if (noOps.length && !dryRun) {
      for (const row of noOps) {
        await db.delete(playerTransfers).where(eq(playerTransfers.id, row.id));
      }
      summary.deleted += noOps.length;
    } else if (noOps.length) {
      summary.deleted += noOps.length;
    }

    if (actionable.length === 0) continue;
    if (actionable.length < 2) {
      summary.kept += actionable.length;
      continue;
    }
    summary.groups += 1;
    actionable.sort((a, b) => scoreTransferKeeper(b) - scoreTransferKeeper(a));
    const keeper = actionable[0]!;
    const losers = actionable.slice(1);

    if (!dryRun) {
      const patch: Partial<{
        fromTeamId: string | null;
        toTeamId: string | null;
        fromClub: string | null;
        toClub: string | null;
        effectiveDate: Date | null;
        sourceUrl: string | null;
        sourceProvider: string | null;
        importKey: string | null;
        notes: string | null;
        positionName: string | null;
      }> = {};
      for (const loser of losers) {
        if (!keeper.fromTeamId && loser.fromTeamId) patch.fromTeamId = loser.fromTeamId;
        if (!keeper.toTeamId && loser.toTeamId) patch.toTeamId = loser.toTeamId;
        if (!keeper.fromClub && loser.fromClub) patch.fromClub = loser.fromClub;
        if (!keeper.toClub && loser.toClub) patch.toClub = loser.toClub;
        if (!keeper.effectiveDate && loser.effectiveDate) patch.effectiveDate = loser.effectiveDate;
        if (!keeper.sourceUrl && loser.sourceUrl) patch.sourceUrl = loser.sourceUrl;
        if (!keeper.importKey && loser.importKey) patch.importKey = loser.importKey;
        if (!keeper.notes && loser.notes) patch.notes = loser.notes;
        if (!keeper.positionName && loser.positionName) patch.positionName = loser.positionName;
      }
      if (Object.keys(patch).length) {
        await db.update(playerTransfers).set(patch).where(eq(playerTransfers.id, keeper.id));
      }
      for (const loser of losers) {
        await db.delete(playerTransfers).where(eq(playerTransfers.id, loser.id));
      }
    }

    summary.kept += 1;
    summary.deleted += losers.length;
    summary.details.push({
      key,
      keptId: keeper.id,
      deletedIds: losers.map((l) => l.id),
    });
  }

  return summary;
}
