import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitionSeasons,
  competitions,
  playerTransfers,
  players,
  teams,
  transferImportLogs,
} from "@rugby365/db";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam } from "./entity-resolve-service";
import { DEFAULT_PREMIERSHIP_TRANSFER_SEASON } from "./premiership-transfer-constants";
import { canonicalPlayerDisplayName } from "./entity-normalize";
import {
  computeTransferAuditStatuses,
  type TransferAuditStatus,
} from "./transfer-audit-utils";
import {
  getProvidersForSourceKey,
  resolveTransferSourceConfidence,
  resolveTransferSourceKey,
  resolveTransferSourceLabel,
} from "./transfer-source-utils";
import {
  resolveTransferClubLabel,
  sanitizeTransferClub,
  sanitizeTransferPlayerName,
  sanitizeTransferPlayerNameWithStatus,
} from "./transfer-display";
import type {
  TransferImportSummary,
  TransferListFilters,
  TransferMovementType,
  TransferScopeType,
} from "./transfer-types";

export type TransferRow = {
  id: string;
  playerId: string;
  playerName: string;
  transferType: TransferScopeType;
  movementType: TransferMovementType;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromTeamName: string | null;
  toTeamName: string | null;
  fromClub: string | null;
  toClub: string | null;
  positionName: string | null;
  effectiveDate: Date | null;
  seasonId: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionName: string | null;
  sourceProvider: string;
  sourceUrl: string | null;
  importKey: string | null;
  notes: string | null;
  createdAt: Date;
  sourceLabel: string;
  sourceKey: string;
  sourceConfidence: "high" | "medium" | "low";
  auditStatuses: TransferAuditStatus[];
  playerClubTeamId: string | null;
};

export type CreateTransferInput = {
  playerId: string;
  fromClub?: string;
  toClub?: string;
  fromTeamId?: string;
  toTeamId?: string;
  transferType?: TransferScopeType;
  movementType?: TransferMovementType;
  seasonId?: string;
  competitionId?: string;
  positionName?: string;
  effectiveDate?: string;
  notes?: string;
  sourceProvider?: string;
  sourceUrl?: string;
  importKey?: string;
  updatePlayerAssignment?: boolean;
  /** Skip async bio refresh (bulk Wikipedia imports). */
  skipBioRefresh?: boolean;
};

function sortColumn(sortBy: TransferListFilters["sortBy"]) {
  switch (sortBy) {
    case "playerName":
      return players.name;
    case "createdAt":
      return playerTransfers.createdAt;
    case "effectiveDate":
    default:
      return playerTransfers.effectiveDate;
  }
}

export async function listTransfersFiltered(filters: TransferListFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const sortBy = filters.sortBy ?? "effectiveDate";
  const sortDir = filters.sortDir ?? "desc";

  const conditions = [];
  if (filters.seasonId) conditions.push(eq(playerTransfers.seasonId, filters.seasonId));
  if (filters.competitionId) conditions.push(eq(playerTransfers.competitionId, filters.competitionId));
  if (filters.playerId) conditions.push(eq(playerTransfers.playerId, filters.playerId));
  if (filters.movementType) conditions.push(eq(playerTransfers.movementType, filters.movementType));
  if (filters.transferType) conditions.push(eq(playerTransfers.transferType, filters.transferType));

  if (filters.teamId && filters.teamDirection === "in") {
    conditions.push(eq(playerTransfers.toTeamId, filters.teamId));
  } else if (filters.teamId && filters.teamDirection === "out") {
    conditions.push(eq(playerTransfers.fromTeamId, filters.teamId));
  } else if (filters.teamId && filters.teamDirection === "current") {
    conditions.push(eq(players.clubTeamId, filters.teamId));
  } else if (filters.teamId) {
    conditions.push(
      or(eq(playerTransfers.fromTeamId, filters.teamId), eq(playerTransfers.toTeamId, filters.teamId)),
    );
  }

  if (filters.sourceKey) {
    const providers = getProvidersForSourceKey(filters.sourceKey);
    if (providers.length > 0) {
      conditions.push(inArray(playerTransfers.sourceProvider, providers));
    }
  }

  if (filters.auditStatus === "missing_source") {
    conditions.push(
      or(
        isNull(playerTransfers.sourceUrl),
        eq(playerTransfers.sourceProvider, "unknown"),
      ),
    );
  } else if (filters.auditStatus === "date_missing") {
    conditions.push(isNull(playerTransfers.effectiveDate));
  } else if (filters.auditStatus === "missing_club_in") {
    conditions.push(
      and(
        isNull(playerTransfers.toTeamId),
        or(isNull(playerTransfers.toClub), eq(playerTransfers.toClub, "")),
      ),
    );
  } else if (filters.auditStatus === "missing_club_out") {
    conditions.push(
      and(
        isNull(playerTransfers.fromTeamId),
        or(isNull(playerTransfers.fromClub), eq(playerTransfers.fromClub, "")),
      ),
    );
  }

  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(players.name, q),
        ilike(playerTransfers.fromClub, q),
        ilike(playerTransfers.toClub, q),
        ilike(playerTransfers.notes, q),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      transfer: playerTransfers,
      playerName: players.name,
      playerClubTeamId: players.clubTeamId,
      seasonLabel: competitionSeasons.label,
      competitionName: competitions.name,
    })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .leftJoin(competitionSeasons, eq(playerTransfers.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(playerTransfers.competitionId, competitions.id))
    .where(whereClause)
    .orderBy(sortDir === "asc" ? asc(sortColumn(sortBy)) : desc(sortColumn(sortBy)))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .where(whereClause);

  const duplicateKeys = await db
    .select({
      playerId: playerTransfers.playerId,
      seasonId: playerTransfers.seasonId,
      fromTeamId: playerTransfers.fromTeamId,
      toTeamId: playerTransfers.toTeamId,
      movementType: playerTransfers.movementType,
      count: sql<number>`count(*)::int`,
    })
    .from(playerTransfers)
    .groupBy(
      playerTransfers.playerId,
      playerTransfers.seasonId,
      playerTransfers.fromTeamId,
      playerTransfers.toTeamId,
      playerTransfers.movementType,
    )
    .having(sql`count(*) > 1`);

  const duplicateLookup = new Set(
    duplicateKeys.map(
      (row) =>
        `${row.playerId}:${row.seasonId ?? ""}:${row.fromTeamId ?? ""}:${row.toTeamId ?? ""}:${row.movementType}`,
    ),
  );

  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((team) => [team.id, team]));

  let transfers: TransferRow[] = rows.map((row) => {
    const duplicateCount = duplicateLookup.has(
      `${row.transfer.playerId}:${row.transfer.seasonId ?? ""}:${row.transfer.fromTeamId ?? ""}:${row.transfer.toTeamId ?? ""}:${row.transfer.movementType}`,
    )
      ? 2
      : 1;
    const sourceConfidence = resolveTransferSourceConfidence({
      sourceProvider: row.transfer.sourceProvider,
      sourceUrl: row.transfer.sourceUrl,
      importKey: row.transfer.importKey,
      fromTeamId: row.transfer.fromTeamId,
      toTeamId: row.transfer.toTeamId,
      effectiveDate: row.transfer.effectiveDate,
    });
    const auditStatuses = computeTransferAuditStatuses({
      id: row.transfer.id,
      playerId: row.transfer.playerId,
      movementType: row.transfer.movementType,
      fromTeamId: row.transfer.fromTeamId,
      toTeamId: row.transfer.toTeamId,
      fromClub: row.transfer.fromClub,
      toClub: row.transfer.toClub,
      effectiveDate: row.transfer.effectiveDate,
      sourceProvider: row.transfer.sourceProvider,
      sourceUrl: row.transfer.sourceUrl,
      importKey: row.transfer.importKey,
      seasonId: row.transfer.seasonId,
      playerClubTeamId: row.playerClubTeamId,
      duplicateCount,
    });

    return {
      id: row.transfer.id,
      playerId: row.transfer.playerId,
      playerName: row.playerName,
      transferType: row.transfer.transferType as TransferScopeType,
      movementType: row.transfer.movementType as TransferMovementType,
      fromTeamId: row.transfer.fromTeamId,
      toTeamId: row.transfer.toTeamId,
      fromTeamName: row.transfer.fromTeamId ? teamById[row.transfer.fromTeamId]?.name ?? null : null,
      toTeamName: row.transfer.toTeamId ? teamById[row.transfer.toTeamId]?.name ?? null : null,
      fromClub: resolveTransferClubLabel({
        teamName: row.transfer.fromTeamId ? teamById[row.transfer.fromTeamId]?.name ?? null : null,
        clubName: row.transfer.fromClub,
        importKey: row.transfer.importKey,
        direction: "from",
      }),
      toClub: resolveTransferClubLabel({
        teamName: row.transfer.toTeamId ? teamById[row.transfer.toTeamId]?.name ?? null : null,
        clubName: row.transfer.toClub,
        importKey: row.transfer.importKey,
        direction: "to",
      }),
      positionName: row.transfer.positionName,
      effectiveDate: row.transfer.effectiveDate,
      seasonId: row.transfer.seasonId,
      seasonLabel: row.seasonLabel,
      competitionId: row.transfer.competitionId,
      competitionName: row.competitionName,
      sourceProvider: row.transfer.sourceProvider,
      sourceUrl: row.transfer.sourceUrl,
      importKey: row.transfer.importKey,
      notes: row.transfer.notes,
      createdAt: row.transfer.createdAt,
      sourceLabel: resolveTransferSourceLabel(row.transfer.sourceProvider),
      sourceKey: resolveTransferSourceKey(row.transfer.sourceProvider),
      sourceConfidence,
      auditStatuses,
      playerClubTeamId: row.playerClubTeamId,
    };
  });

  if (filters.sourceConfidence) {
    transfers = transfers.filter((row) => row.sourceConfidence === filters.sourceConfidence);
  }

  if (
    filters.auditStatus &&
    !["missing_source", "date_missing", "missing_club_in", "missing_club_out"].includes(filters.auditStatus)
  ) {
    transfers = transfers.filter((row) => row.auditStatuses.includes(filters.auditStatus as TransferAuditStatus));
  }

  return {
    transfers,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    },
  };
}

async function assertNoDuplicateManualTransfer(input: CreateTransferInput) {
  if (input.importKey) return;
  const db = getDb();
  const conditions = [eq(playerTransfers.playerId, input.playerId)];
  if (input.fromTeamId) conditions.push(eq(playerTransfers.fromTeamId, input.fromTeamId));
  if (input.toTeamId) conditions.push(eq(playerTransfers.toTeamId, input.toTeamId));
  if (input.movementType) conditions.push(eq(playerTransfers.movementType, input.movementType));
  if (input.seasonId) conditions.push(eq(playerTransfers.seasonId, input.seasonId));

  const [existing] = await db
    .select({ id: playerTransfers.id })
    .from(playerTransfers)
    .where(and(...conditions))
    .limit(1);
  if (existing) {
    throw new Error("A similar transfer already exists for this player, season and clubs.");
  }
}

export async function createTransferRecord(input: CreateTransferInput) {
  const db = getDb();
  const transferType = input.transferType ?? "club";
  const movementType = input.movementType ?? "permanent";

  const [player] = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  let fromTeamId = input.fromTeamId ?? null;
  let toTeamId = input.toTeamId ?? null;
  let fromClub = sanitizeTransferClub(input.fromClub?.trim()) || null;
  let toClub = sanitizeTransferClub(input.toClub?.trim()) || null;

  if (toTeamId) {
    const [toTeam] = await db.select().from(teams).where(eq(teams.id, toTeamId)).limit(1);
    if (!toTeam) throw new Error("Destination team not found");
    toClub = sanitizeTransferClub(toTeam.name) ?? toTeam.name;
  } else if (!toClub && movementType !== "released" && movementType !== "retirement") {
    throw new Error("Destination team or club is required");
  }

  if (!fromTeamId && transferType === "club" && player.clubTeamId) {
    fromTeamId = player.clubTeamId;
  }
  if (!fromTeamId && transferType === "international" && player.internationalTeamId) {
    fromTeamId = player.internationalTeamId;
  }
  if (fromTeamId) {
    const [fromTeam] = await db.select().from(teams).where(eq(teams.id, fromTeamId)).limit(1);
    fromClub = sanitizeTransferClub(fromTeam?.name) ?? fromTeam?.name ?? fromClub;
  } else if (!fromClub) {
    fromClub = transferType === "club" ? player.clubName : player.countryName;
  }

  if (input.importKey) {
    const [existing] = await db
      .select()
      .from(playerTransfers)
      .where(eq(playerTransfers.importKey, input.importKey))
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(playerTransfers)
        .set({
          fromClub,
          toClub,
          fromTeamId,
          toTeamId,
          transferType,
          movementType,
          seasonId: input.seasonId ?? existing.seasonId,
          competitionId: input.competitionId ?? existing.competitionId,
          positionName: input.positionName ?? existing.positionName,
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : existing.effectiveDate,
          notes: input.notes?.trim() ?? existing.notes,
          sourceProvider: input.sourceProvider ?? existing.sourceProvider,
          sourceUrl: input.sourceUrl ?? existing.sourceUrl,
        })
        .where(eq(playerTransfers.id, existing.id))
        .returning();
      const { reconcilePlayerCareerStatus } = await import("./player-career-status-service");
      await reconcilePlayerCareerStatus(input.playerId);
      const { applyTransferToMemberships } = await import("./player-membership-service");
      await applyTransferToMemberships({
        playerId: input.playerId,
        fromTeamId,
        toTeamId,
        seasonId: input.seasonId ?? updated!.seasonId ?? null,
        competitionId: input.competitionId ?? updated!.competitionId ?? null,
        movementType,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : updated!.effectiveDate,
        sourceProvider: input.sourceProvider ?? updated!.sourceProvider,
        sourceUrl: input.sourceUrl ?? updated!.sourceUrl,
      });
      return { transfer: updated!, updated: true };
    }
  } else {
    await assertNoDuplicateManualTransfer(input);
  }

  const [row] = await db
    .insert(playerTransfers)
    .values({
      playerId: input.playerId,
      fromClub,
      toClub,
      fromTeamId,
      toTeamId,
      transferType,
      movementType,
      seasonId: input.seasonId ?? null,
      competitionId: input.competitionId ?? null,
      positionName: input.positionName?.trim() || null,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : new Date(),
      sourceProvider: input.sourceProvider ?? "manual",
      sourceUrl: input.sourceUrl ?? null,
      importKey: input.importKey ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  if (input.updatePlayerAssignment !== false && toClub) {
    if (transferType === "club" && movementType !== "retirement") {
      await db
        .update(players)
        .set({
          clubName: toClub,
          clubTeamId: toTeamId,
          name: canonicalPlayerDisplayName(player.name),
        })
        .where(eq(players.id, input.playerId));
    } else if (transferType === "international") {
      await db
        .update(players)
        .set({
          countryName: toClub,
          internationalTeamId: toTeamId,
        })
        .where(eq(players.id, input.playerId));
    }
  }

  const { triggerPlayerBioRefresh } = await import("./player-bio-trigger");
  if (!input.skipBioRefresh) {
    void triggerPlayerBioRefresh({
      playerId: input.playerId,
      trigger: transferType === "international" ? "international_status_changed" : "transfer_added",
    });
  }

  const { reconcilePlayerCareerStatus } = await import("./player-career-status-service");
  await reconcilePlayerCareerStatus(input.playerId);

  const { applyTransferToMemberships } = await import("./player-membership-service");
  await applyTransferToMemberships({
    playerId: input.playerId,
    fromTeamId,
    toTeamId,
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    movementType,
    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : row!.effectiveDate,
    sourceProvider: input.sourceProvider ?? row!.sourceProvider,
    sourceUrl: input.sourceUrl ?? row!.sourceUrl,
  });

  return { transfer: row!, updated: false };
}

export async function deleteTransferRecord(id: string) {
  const db = getDb();
  const [row] = await db.delete(playerTransfers).where(eq(playerTransfers.id, id)).returning({ id: playerTransfers.id });
  if (!row) throw new Error("Transfer not found");
  return row;
}

export async function bulkDeleteTransfers(ids: string[]) {
  if (ids.length === 0) return { deleted: 0 };
  const db = getDb();
  const rows = await db
    .delete(playerTransfers)
    .where(inArray(playerTransfers.id, ids))
    .returning({ id: playerTransfers.id });
  return { deleted: rows.length };
}

export async function getTeamTransferHistory(teamId: string) {
  const db = getDb();
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const [team] = allTeams.filter((row) => row.id === teamId);
  const teamName = team?.name ? sanitizeTransferClub(team.name) : null;
  const relatedTeamIds = teamName
    ? allTeams
        .filter((row) => sanitizeTransferClub(row.name) === teamName)
        .map((row) => row.id)
    : [teamId];

  const fromTeams = alias(teams, "from_teams");
  const toTeams = alias(teams, "to_teams");
  const rows = await db
    .select({
      transfer: playerTransfers,
      playerName: players.name,
      seasonLabel: competitionSeasons.label,
      fromTeamName: fromTeams.name,
      toTeamName: toTeams.name,
    })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .leftJoin(competitionSeasons, eq(playerTransfers.seasonId, competitionSeasons.id))
    .leftJoin(fromTeams, eq(playerTransfers.fromTeamId, fromTeams.id))
    .leftJoin(toTeams, eq(playerTransfers.toTeamId, toTeams.id))
    .where(
      or(
        inArray(playerTransfers.fromTeamId, relatedTeamIds),
        inArray(playerTransfers.toTeamId, relatedTeamIds),
      ),
    )
    .orderBy(desc(playerTransfers.effectiveDate));

  const playersInBySeason = new Map<string, TransferRow[]>();
  const playersOutBySeason = new Map<string, TransferRow[]>();
  const seenIn = new Set<string>();
  const seenOut = new Set<string>();

  for (const row of rows) {
    const seasonKey = row.seasonLabel ?? "Unknown season";
    const fromClub = resolveTransferClubLabel({
      teamName: row.fromTeamName,
      clubName: row.transfer.fromClub,
      importKey: row.transfer.importKey,
      direction: "from",
      premiershipClub: teamName,
    });
    const toClub = resolveTransferClubLabel({
      teamName: row.toTeamName,
      clubName: row.transfer.toClub,
      importKey: row.transfer.importKey,
      direction: "to",
      premiershipClub: teamName,
    });
    const entry: TransferRow = {
      id: row.transfer.id,
      playerId: row.transfer.playerId,
      playerName: sanitizeTransferPlayerName(row.playerName),
      transferType: row.transfer.transferType as TransferScopeType,
      movementType: row.transfer.movementType as TransferMovementType,
      fromTeamId: row.transfer.fromTeamId,
      toTeamId: row.transfer.toTeamId,
      fromTeamName: sanitizeTransferClub(row.fromTeamName),
      toTeamName: sanitizeTransferClub(row.toTeamName),
      fromClub,
      toClub,
      positionName: row.transfer.positionName,
      effectiveDate: row.transfer.effectiveDate,
      seasonId: row.transfer.seasonId,
      seasonLabel: row.seasonLabel,
      competitionId: row.transfer.competitionId,
      competitionName: null,
      sourceProvider: row.transfer.sourceProvider,
      sourceUrl: row.transfer.sourceUrl,
      importKey: row.transfer.importKey,
      notes: row.transfer.notes,
      createdAt: row.transfer.createdAt,
    };

    const importDirection = row.transfer.importKey?.split(":")[2];
    const isIncoming =
      importDirection === "in" ||
      (importDirection !== "out" &&
        ((row.transfer.toTeamId && relatedTeamIds.includes(row.transfer.toTeamId)) ||
          (teamName !== null && (toClub === teamName || entry.toTeamName === teamName))));
    const isOutgoing =
      importDirection === "out" ||
      (importDirection !== "in" &&
        ((row.transfer.fromTeamId && relatedTeamIds.includes(row.transfer.fromTeamId)) ||
          (teamName !== null && (fromClub === teamName || entry.fromTeamName === teamName))));

    if (isIncoming) {
      const dedupeKey = `${seasonKey}:${entry.playerId}:${entry.movementType}:${entry.fromClub ?? ""}`;
      if (!seenIn.has(dedupeKey)) {
        seenIn.add(dedupeKey);
        const bucket = playersInBySeason.get(seasonKey) ?? [];
        bucket.push(entry);
        playersInBySeason.set(seasonKey, bucket);
      }
    }
    if (isOutgoing) {
      const dedupeKey = `${seasonKey}:${entry.playerId}:${entry.movementType}:${entry.toClub ?? ""}`;
      if (!seenOut.has(dedupeKey)) {
        seenOut.add(dedupeKey);
        const bucket = playersOutBySeason.get(seasonKey) ?? [];
        bucket.push(entry);
        playersOutBySeason.set(seasonKey, bucket);
      }
    }
  }

  return {
    playersInBySeason: [...playersInBySeason.entries()].map(([season, items]) => ({ season, items })),
    playersOutBySeason: [...playersOutBySeason.entries()].map(([season, items]) => ({ season, items })),
  };
}

export async function getPlayerCareerTimeline(playerId: string) {
  const db = getDb();
  return db
    .select({
      id: playerTransfers.id,
      fromClub: playerTransfers.fromClub,
      toClub: playerTransfers.toClub,
      fromTeamId: playerTransfers.fromTeamId,
      toTeamId: playerTransfers.toTeamId,
      transferType: playerTransfers.transferType,
      movementType: playerTransfers.movementType,
      effectiveDate: playerTransfers.effectiveDate,
      seasonLabel: competitionSeasons.label,
      competitionName: competitions.name,
      positionName: playerTransfers.positionName,
      notes: playerTransfers.notes,
      sourceProvider: playerTransfers.sourceProvider,
    })
    .from(playerTransfers)
    .leftJoin(competitionSeasons, eq(playerTransfers.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(playerTransfers.competitionId, competitions.id))
    .where(eq(playerTransfers.playerId, playerId))
    .orderBy(desc(playerTransfers.effectiveDate), desc(playerTransfers.createdAt));
}

export async function resolvePremiershipSeason(seasonLabel = DEFAULT_PREMIERSHIP_TRANSFER_SEASON) {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "premiership"))
    .limit(1);
  if (!competition) throw new Error("Premiership competition not found");

  let [season] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.label, seasonLabel)))
    .limit(1);

  if (!season) {
    const yearMatch = seasonLabel.match(/^(\d{4})/);
    const year = yearMatch ? Number.parseInt(yearMatch[1]!, 10) : new Date().getFullYear();
    const slug = seasonLabel
      .replace(/\u2013/g, "-")
      .replace(/[^\d-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    [season] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: slug || String(year),
        label: seasonLabel,
        year,
        isActive: false,
        sourceProvider: "wikipedia",
      })
      .onConflictDoNothing()
      .returning();

    if (!season) {
      [season] = await db
        .select()
        .from(competitionSeasons)
        .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.label, seasonLabel)))
        .limit(1);
    }
  }

  return { competition, season: season ?? null };
}

export async function createTransferImportLog(input: {
  sourceUrl: string;
  seasonLabel?: string;
  competitionId?: string;
  summary: TransferImportSummary;
  status?: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(transferImportLogs)
    .values({
      sourceUrl: input.sourceUrl,
      seasonLabel: input.seasonLabel ?? null,
      competitionId: input.competitionId ?? null,
      status: input.status ?? "completed",
      summary: input.summary,
      warnings: input.summary.warnings,
      errors: input.summary.errors,
      completedAt: new Date(),
    })
    .returning();
  return row;
}

export async function listTransferImportLogs(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(transferImportLogs)
    .orderBy(desc(transferImportLogs.startedAt))
    .limit(limit);
}

/** Resolve or create a team for transfer import — never duplicates when matched. */
export async function resolveTransferTeam(name: string, createIfMissing = false) {
  const { isJunkTeamPickerName, sanitizeTeamDisplayName } = await import("./transfer-display");
  const cleaned = sanitizeTeamDisplayName(name);
  if (!cleaned || isJunkTeamPickerName(cleaned)) return null;
  const { canonicalPremiershipTeamName } = await import("./transfer-match-service");
  return resolveTeam({
    name: canonicalPremiershipTeamName(cleaned),
    createIfMissing,
    sourceProvider: "wikipedia",
  });
}

/** Resolve or create a player — caller must gate on match confidence. */
export async function resolveTransferPlayer(input: {
  name: string;
  positionName?: string;
  clubName?: string;
  careerStatus?: string;
  createIfMissing?: boolean;
}) {
  const parsed = sanitizeTransferPlayerNameWithStatus(input.name);
  const player = await resolvePlayer({
    name: parsed.name,
    positionName: input.positionName,
    clubName: sanitizeTransferClub(input.clubName) ?? undefined,
    createIfMissing: input.createIfMissing ?? false,
    skipArchiveEnrich: true,
  });
  if (player && (parsed.statusHint || input.careerStatus)) {
    const { applyPlayerCareerStatus } = await import("./player-career-status-service");
    const { normalizePlayerCareerStatus } = await import("./player-career-status");
    await applyPlayerCareerStatus(
      player.id,
      normalizePlayerCareerStatus(input.careerStatus ?? parsed.statusHint ?? "active"),
    );
  }
  return player;
}
