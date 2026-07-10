import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  playerTransfers,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { parseSeasonStartYear } from "./season-label-utils";
import {
  getPlayersLinkedByClubTeamId,
  listMembershipsForTeamSeason,
} from "./player-membership-service";
import { getTeamTransferHistory } from "./transfer-admin-service";
import { sanitizeTransferPlayerName } from "./transfer-display";
import {
  resolveTransferSourceConfidence,
  resolveTransferSourceLabel,
} from "./transfer-source-utils";
import { computeTransferAuditStatuses } from "./transfer-audit-utils";

export type ClubAuditPlayerRow = {
  id: string;
  name: string;
  currentClubName?: string | null;
  transferSource?: string | null;
  sourceConfidence?: string | null;
  detail?: string | null;
};

export type ClubTransferAuditReport = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonLabel: string;
  competitionId: string;
  competitionName: string;
  currentSquad: ClubAuditPlayerRow[];
  transfersIn: ClubAuditPlayerRow[];
  transfersOut: ClubAuditPlayerRow[];
  noTransferRecord: ClubAuditPlayerRow[];
  missingSource: ClubAuditPlayerRow[];
  conflictingCurrentClub: ClubAuditPlayerRow[];
  counts: {
    currentSquad: number;
    transfersIn: number;
    transfersOut: number;
    noTransferRecord: number;
    missingSource: number;
    conflictingCurrentClub: number;
  };
};

function dedupeRows(rows: ClubAuditPlayerRow[]): ClubAuditPlayerRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function auditClubTransfers(input: {
  teamId: string;
  seasonId: string;
}): Promise<ClubTransferAuditReport | null> {
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1);
  if (!team) return null;

  const [season] = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, input.seasonId))
    .limit(1);
  if (!season) return null;

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, season.competitionId))
    .limit(1);
  if (!competition) return null;

  const seasonYear = season.year ?? parseSeasonStartYear(season.label);
  if (seasonYear == null) return null;

  const [clubLinked, activeMemberships, transferHistory, seasonTransfers] = await Promise.all([
    getPlayersLinkedByClubTeamId(input.teamId),
    listMembershipsForTeamSeason(input.teamId, input.seasonId, ["active", "incoming", "loan_in"]),
    getTeamTransferHistory(input.teamId),
    db
      .select({
        transfer: playerTransfers,
        playerName: players.name,
        playerClubTeamId: players.clubTeamId,
        playerClubName: players.clubName,
      })
      .from(playerTransfers)
      .innerJoin(players, eq(playerTransfers.playerId, players.id))
      .where(
        and(
          eq(playerTransfers.seasonId, input.seasonId),
          or(
            eq(playerTransfers.fromTeamId, input.teamId),
            eq(playerTransfers.toTeamId, input.teamId),
          ),
        ),
      ),
  ]);

  const transfersInRaw =
    transferHistory.playersInBySeason.find((bucket) => bucket.season === season.label)?.items ?? [];
  const transfersOutRaw =
    transferHistory.playersOutBySeason.find((bucket) => bucket.season === season.label)?.items ?? [];

  const transferPlayerIds = new Set(seasonTransfers.map((row) => row.transfer.playerId));

  const currentSquad: ClubAuditPlayerRow[] = dedupeRows([
    ...activeMemberships.map((row) => ({
      id: row.playerId,
      name: row.playerName,
      currentClubName: team.name,
      transferSource: row.sourceProvider,
      sourceConfidence: transferSourceConfidenceLabel(
        resolveTransferSourceConfidence({
          sourceProvider: row.sourceProvider,
          sourceUrl: row.sourceUrl,
        }),
      ),
    })),
    ...clubLinked.map((row) => ({
      id: row.id,
      name: row.name,
      currentClubName: row.clubName ?? team.name,
      detail: "Linked via player.clubTeamId",
    })),
  ]);

  const transfersIn: ClubAuditPlayerRow[] = transfersInRaw.map((row) => ({
    id: row.playerId,
    name: sanitizeTransferPlayerName(row.playerName),
    currentClubName: row.toClub ?? row.toTeamName,
    transferSource: resolveTransferSourceLabel(row.sourceProvider),
    sourceConfidence: transferSourceConfidenceLabel(
      resolveTransferSourceConfidence({
        sourceProvider: row.sourceProvider,
        sourceUrl: row.sourceUrl,
        importKey: row.importKey,
        fromTeamId: row.fromTeamId,
        toTeamId: row.toTeamId,
        effectiveDate: row.effectiveDate,
      }),
    ),
    detail: row.fromClub ?? row.fromTeamName ?? undefined,
  }));

  const transfersOut: ClubAuditPlayerRow[] = transfersOutRaw.map((row) => ({
    id: row.playerId,
    name: sanitizeTransferPlayerName(row.playerName),
    currentClubName: row.fromClub ?? row.fromTeamName,
    transferSource: resolveTransferSourceLabel(row.sourceProvider),
    sourceConfidence: transferSourceConfidenceLabel(
      resolveTransferSourceConfidence({
        sourceProvider: row.sourceProvider,
        sourceUrl: row.sourceUrl,
        importKey: row.importKey,
        fromTeamId: row.fromTeamId,
        toTeamId: row.toTeamId,
        effectiveDate: row.effectiveDate,
      }),
    ),
    detail: row.toClub ?? row.toTeamName ?? undefined,
  }));

  const squadIds = new Set(currentSquad.map((row) => row.id));
  const noTransferRecord = currentSquad.filter((row) => !transferPlayerIds.has(row.id));

  const missingSource: ClubAuditPlayerRow[] = [];
  const conflictingCurrentClub: ClubAuditPlayerRow[] = [];

  for (const row of seasonTransfers) {
    const statuses = computeTransferAuditStatuses({
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
    });

    const playerRow: ClubAuditPlayerRow = {
      id: row.transfer.playerId,
      name: sanitizeTransferPlayerName(row.playerName),
      currentClubName: row.playerClubName,
      transferSource: resolveTransferSourceLabel(row.transfer.sourceProvider),
      sourceConfidence: transferSourceConfidenceLabel(
        resolveTransferSourceConfidence({
          sourceProvider: row.transfer.sourceProvider,
          sourceUrl: row.transfer.sourceUrl,
          importKey: row.transfer.importKey,
          fromTeamId: row.transfer.fromTeamId,
          toTeamId: row.transfer.toTeamId,
          effectiveDate: row.transfer.effectiveDate,
        }),
      ),
    };

    if (statuses.includes("missing_source")) {
      missingSource.push(playerRow);
    }

    if (
      row.transfer.toTeamId === input.teamId &&
      row.playerClubTeamId &&
      row.playerClubTeamId !== input.teamId
    ) {
      conflictingCurrentClub.push({
        ...playerRow,
        detail: `Profile club differs from transfer destination`,
      });
    } else if (squadIds.has(row.transfer.playerId) && transfersOutRaw.some((t) => t.playerId === row.transfer.playerId)) {
      conflictingCurrentClub.push({
        ...playerRow,
        detail: "Transfer out recorded but still on current squad",
      });
    }
  }

  return {
    teamId: input.teamId,
    teamName: team.name,
    seasonId: input.seasonId,
    seasonLabel: season.label,
    competitionId: competition.id,
    competitionName: competition.name,
    currentSquad,
    transfersIn: dedupeRows(transfersIn),
    transfersOut: dedupeRows(transfersOut),
    noTransferRecord: dedupeRows(noTransferRecord),
    missingSource: dedupeRows(missingSource),
    conflictingCurrentClub: dedupeRows(conflictingCurrentClub),
    counts: {
      currentSquad: currentSquad.length,
      transfersIn: transfersIn.length,
      transfersOut: transfersOut.length,
      noTransferRecord: noTransferRecord.length,
      missingSource: missingSource.length,
      conflictingCurrentClub: conflictingCurrentClub.length,
    },
  };
}

function transferSourceConfidenceLabel(
  confidence: ReturnType<typeof resolveTransferSourceConfidence>,
): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}
