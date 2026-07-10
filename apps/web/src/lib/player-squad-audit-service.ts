import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerSeasonStats,
  playerTeamMemberships,
  playerTransfers,
  players,
  standingRows,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { kickoffInSeason, parseSeasonStartYear } from "./season-label-utils";
import {
  findPlayerDuplicateGroups,
  findReversedNameRows,
  suggestedCanonicalName,
  type PlayerDuplicateGroup,
} from "./player-identity-service";
import {
  getPlayersLinkedByClubTeamId,
  isActiveSquadMembership,
  listMembershipsForTeamSeason,
  type PlayerMembershipRow,
} from "./player-membership-service";
import { getTeamTransferHistory } from "./transfer-admin-service";
import { sanitizeTransferPlayerName } from "./transfer-display";

export type SquadAuditPlayerRef = {
  id: string;
  name: string;
  suggestedName?: string;
  careerStatus?: string | null;
  membershipStatus?: string | null;
  destinationClub?: string | null;
  source?: string;
};

export type TeamSeasonSquadAudit = {
  teamId: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonLabel: string;
  validCurrent: SquadAuditPlayerRef[];
  incoming: SquadAuditPlayerRef[];
  departed: SquadAuditPlayerRef[];
  historicLeaking: SquadAuditPlayerRef[];
  duplicateGroups: PlayerDuplicateGroup[];
  reversedNames: SquadAuditPlayerRef[];
  noSeasonMembership: SquadAuditPlayerRef[];
  multiClubSameSeason: Array<{
    playerId: string;
    playerName: string;
    teams: Array<{ teamId: string; teamName: string; status: string }>;
  }>;
  counts: {
    clubTeamIdLinked: number;
    activeMemberships: number;
    fixtureSquad: number;
    transfersIn: number;
    transfersOut: number;
  };
};

export type FullSquadAuditReport = {
  generatedAt: string;
  competitionCount: number;
  teamCount: number;
  totals: {
    validCurrent: number;
    incoming: number;
    departed: number;
    historicLeaking: number;
    duplicateGroups: number;
    reversedNames: number;
    noSeasonMembership: number;
    multiClubSameSeason: number;
  };
  teams: TeamSeasonSquadAudit[];
};

type PlayerRef = { id: string; name: string };

async function fixtureSquadForTeamSeason(input: {
  teamId: string;
  competitionId: string;
  seasonYear: number;
}): Promise<PlayerRef[]> {
  const db = getDb();
  const rows = await db
    .select({
      playerId: fixturePlayers.playerId,
      playerName: players.name,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(
      and(eq(fixturePlayers.teamId, input.teamId), eq(fixtures.competitionId, input.competitionId)),
    );

  const byPlayer = new Map<string, PlayerRef>();
  for (const row of rows) {
    if (!kickoffInSeason(row.kickoffAt, input.seasonYear)) continue;
    if (!byPlayer.has(row.playerId)) {
      byPlayer.set(row.playerId, { id: row.playerId, name: row.playerName });
    }
  }
  return [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function membershipByPlayer(memberships: PlayerMembershipRow[]) {
  return new Map(memberships.map((row) => [row.playerId, row]));
}

export async function auditTeamSeasonSquad(input: {
  teamId: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonLabel: string;
  seasonYear: number;
}): Promise<TeamSeasonSquadAudit> {
  const [clubLinked, allMemberships, activeMemberships, fixtureSquad, transferHistory] =
    await Promise.all([
      getPlayersLinkedByClubTeamId(input.teamId),
      listMembershipsForTeamSeason(input.teamId, input.seasonId),
      listMembershipsForTeamSeason(input.teamId, input.seasonId, ["active", "incoming", "loan_in"]),
      fixtureSquadForTeamSeason({
        teamId: input.teamId,
        competitionId: input.competitionId,
        seasonYear: input.seasonYear,
      }),
      getTeamTransferHistory(input.teamId),
    ]);

  const membershipMap = membershipByPlayer(allMemberships);
  const activeMembershipIds = new Set(activeMemberships.map((row) => row.playerId));
  const fixtureIds = new Set(fixtureSquad.map((row) => row.id));
  const officialIds = new Set([...activeMembershipIds, ...fixtureIds]);

  const seasonTransfersIn =
    transferHistory.playersInBySeason.find((bucket) => bucket.season === input.seasonLabel)?.items ??
    [];
  const seasonTransfersOut =
    transferHistory.playersOutBySeason.find((bucket) => bucket.season === input.seasonLabel)?.items ??
    [];

  const departedIds = new Set(seasonTransfersOut.map((row) => row.playerId));
  const incomingIds = new Set(seasonTransfersIn.map((row) => row.playerId));

  const validCurrent: SquadAuditPlayerRef[] = [];
  const incoming: SquadAuditPlayerRef[] = [];
  const departed: SquadAuditPlayerRef[] = [];
  const historicLeaking: SquadAuditPlayerRef[] = [];
  const noSeasonMembership: SquadAuditPlayerRef[] = [];

  for (const member of activeMemberships) {
    if (departedIds.has(member.playerId)) {
      departed.push({
        id: member.playerId,
        name: member.playerName,
        membershipStatus: member.status,
        source: "membership_active_but_transfer_out",
      });
      continue;
    }
    validCurrent.push({
      id: member.playerId,
      name: member.playerName,
      membershipStatus: member.status,
      source: member.sourceProvider,
    });
  }

  for (const transfer of seasonTransfersIn) {
    if (validCurrent.some((row) => row.id === transfer.playerId)) continue;
    incoming.push({
      id: transfer.playerId,
      name: sanitizeTransferPlayerName(transfer.playerName),
      destinationClub: transfer.toClub ?? transfer.toTeamName,
      source: "transfer_in",
    });
  }

  for (const transfer of seasonTransfersOut) {
    const stillLinked = clubLinked.some((row) => row.id === transfer.playerId);
    const stillActive = activeMembershipIds.has(transfer.playerId);
    if (stillLinked || stillActive) {
      departed.push({
        id: transfer.playerId,
        name: sanitizeTransferPlayerName(transfer.playerName),
        destinationClub: transfer.toClub ?? transfer.toTeamName,
        membershipStatus: membershipMap.get(transfer.playerId)?.status ?? null,
        source: stillLinked ? "club_team_id_stale" : "membership_stale",
      });
    }
  }

  for (const player of clubLinked) {
    const membership = membershipMap.get(player.id);
    const inOfficial = officialIds.has(player.id);
    const isDeparted = departedIds.has(player.id);

    if (!membership && !inOfficial) {
      historicLeaking.push({
        id: player.id,
        name: player.name,
        careerStatus: player.careerStatus,
        source: "club_team_id_only",
      });
      noSeasonMembership.push({
        id: player.id,
        name: player.name,
        careerStatus: player.careerStatus,
        source: "club_team_id_no_membership",
      });
      continue;
    }

    if (isDeparted && (membership ? isActiveSquadMembership(membership.status) : true)) {
      if (!departed.some((row) => row.id === player.id)) {
        departed.push({
          id: player.id,
          name: player.name,
          membershipStatus: membership?.status ?? null,
          source: "transfer_out_still_linked",
        });
      }
    }

    if (!inOfficial && !isDeparted && !historicLeaking.some((row) => row.id === player.id)) {
      historicLeaking.push({
        id: player.id,
        name: player.name,
        careerStatus: player.careerStatus,
        membershipStatus: membership?.status ?? null,
        source: membership ? "inactive_membership" : "club_team_id_leak",
      });
    }
  }

  const auditPool = [
    ...clubLinked.map((row) => ({ id: row.id, name: row.name })),
    ...activeMemberships.map((row) => ({ id: row.playerId, name: row.playerName })),
    ...fixtureSquad,
  ];
  const uniquePool = [...new Map(auditPool.map((row) => [row.id, row])).values()];
  const duplicateGroups = findPlayerDuplicateGroups(uniquePool);
  const reversedNames = findReversedNameRows(uniquePool).map((row) => ({
    id: row.id,
    name: row.name,
    suggestedName: row.suggestedName,
    source: "reversed_import",
  }));

  const db = getDb();
  const multiClubRows = await db
    .select({
      playerId: playerTeamMemberships.playerId,
      playerName: players.name,
      teamId: playerTeamMemberships.teamId,
      teamName: teams.name,
      status: playerTeamMemberships.status,
    })
    .from(playerTeamMemberships)
    .innerJoin(players, eq(playerTeamMemberships.playerId, players.id))
    .innerJoin(teams, eq(playerTeamMemberships.teamId, teams.id))
    .where(
      and(
        eq(playerTeamMemberships.seasonId, input.seasonId),
        inArray(playerTeamMemberships.status, ["active", "incoming", "loan_in"]),
      ),
    );

  const multiByPlayer = new Map<
    string,
    { playerName: string; teams: Array<{ teamId: string; teamName: string; status: string }> }
  >();
  for (const row of multiClubRows) {
    if (row.teamId === input.teamId) continue;
    const bucket = multiByPlayer.get(row.playerId) ?? { playerName: row.playerName, teams: [] };
    bucket.teams.push({ teamId: row.teamId, teamName: row.teamName, status: row.status });
    multiByPlayer.set(row.playerId, bucket);
  }

  const teamPlayerIds = new Set([
    ...clubLinked.map((row) => row.id),
    ...activeMemberships.map((row) => row.playerId),
  ]);
  const multiClubSameSeason = [...multiByPlayer.entries()]
    .filter(([playerId]) => teamPlayerIds.has(playerId))
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      teams: [
        { teamId: input.teamId, teamName: input.teamName, status: "linked_here" },
        ...data.teams,
      ],
    }));

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    competitionId: input.competitionId,
    competitionName: input.competitionName,
    seasonId: input.seasonId,
    seasonLabel: input.seasonLabel,
    validCurrent: dedupeRefs(validCurrent),
    incoming: dedupeRefs(incoming),
    departed: dedupeRefs(departed),
    historicLeaking: dedupeRefs(historicLeaking),
    duplicateGroups,
    reversedNames: dedupeRefs(reversedNames),
    noSeasonMembership: dedupeRefs(noSeasonMembership),
    multiClubSameSeason,
    counts: {
      clubTeamIdLinked: clubLinked.length,
      activeMemberships: activeMemberships.length,
      fixtureSquad: fixtureSquad.length,
      transfersIn: seasonTransfersIn.length,
      transfersOut: seasonTransfersOut.length,
    },
  };
}

function dedupeRefs(rows: SquadAuditPlayerRef[]): SquadAuditPlayerRef[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function runFullSquadAudit(options?: {
  competitionId?: string;
  seasonId?: string;
  rebuildMemberships?: boolean;
}): Promise<FullSquadAuditReport> {
  const db = getDb();
  const generatedAt = new Date().toISOString();

  let competitionRows = await db
    .select()
    .from(competitions)
    .orderBy(asc(competitions.name));

  if (options?.competitionId) {
    competitionRows = competitionRows.filter((row) => row.id === options.competitionId);
  }

  const teamAudits: TeamSeasonSquadAudit[] = [];

  for (const competition of competitionRows) {
    const seasonConditions = [
      eq(competitionSeasons.competitionId, competition.id),
      eq(competitionSeasons.isDeprecated, false),
    ];
    if (options?.seasonId) {
      seasonConditions.push(eq(competitionSeasons.id, options.seasonId));
    }

    const seasons = await db
      .select()
      .from(competitionSeasons)
      .where(and(...seasonConditions))
      .orderBy(desc(competitionSeasons.year));

    const season =
      seasons.find((row) => row.isActive) ??
      seasons[0];
    if (!season) continue;

    const seasonYear = season.year ?? parseSeasonStartYear(season.label);
    if (seasonYear == null) continue;

    if (options?.rebuildMemberships) {
      const { rebuildTeamSeasonMemberships } = await import("./player-membership-service");
      const standingTeamRows = await db
        .select({ teamId: standingRows.teamId })
        .from(standingRows)
        .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));
      for (const row of standingTeamRows) {
        await rebuildTeamSeasonMemberships({
          teamId: row.teamId,
          seasonId: season.id,
          competitionId: competition.id,
          seasonYear,
        });
      }
    }

    const standingTeams = await db
      .select({ teamId: standingRows.teamId, teamName: teams.name })
      .from(standingRows)
      .innerJoin(teams, eq(standingRows.teamId, teams.id))
      .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")))
      .orderBy(asc(teams.name));

    for (const standingTeam of standingTeams) {
      teamAudits.push(
        await auditTeamSeasonSquad({
          teamId: standingTeam.teamId,
          teamName: standingTeam.teamName,
          competitionId: competition.id,
          competitionName: competition.name,
          seasonId: season.id,
          seasonLabel: season.label,
          seasonYear,
        }),
      );
    }
  }

  const totals = teamAudits.reduce(
    (acc, team) => {
      acc.validCurrent += team.validCurrent.length;
      acc.incoming += team.incoming.length;
      acc.departed += team.departed.length;
      acc.historicLeaking += team.historicLeaking.length;
      acc.duplicateGroups += team.duplicateGroups.length;
      acc.reversedNames += team.reversedNames.length;
      acc.noSeasonMembership += team.noSeasonMembership.length;
      acc.multiClubSameSeason += team.multiClubSameSeason.length;
      return acc;
    },
    {
      validCurrent: 0,
      incoming: 0,
      departed: 0,
      historicLeaking: 0,
      duplicateGroups: 0,
      reversedNames: 0,
      noSeasonMembership: 0,
      multiClubSameSeason: 0,
    },
  );

  return {
    generatedAt,
    competitionCount: new Set(teamAudits.map((row) => row.competitionId)).size,
    teamCount: teamAudits.length,
    totals,
    teams: teamAudits,
  };
}

export function formatSquadAuditSummaryForTeam(audit: TeamSeasonSquadAudit): string {
  const lines = [
    `# ${audit.teamName} — ${audit.competitionName} ${audit.seasonLabel}`,
    `club_team_id linked: ${audit.counts.clubTeamIdLinked}`,
    `active memberships: ${audit.counts.activeMemberships}`,
    `fixture squad: ${audit.counts.fixtureSquad}`,
    `transfers in/out: ${audit.counts.transfersIn}/${audit.counts.transfersOut}`,
    "",
    `Valid current (${audit.validCurrent.length}): ${audit.validCurrent.map((p) => suggestedCanonicalName(p.name)).join(", ") || "—"}`,
    `Incoming (${audit.incoming.length}): ${audit.incoming.map((p) => p.name).join(", ") || "—"}`,
    `Departed still shown (${audit.departed.length}): ${audit.departed.map((p) => `${p.name}${p.destinationClub ? ` → ${p.destinationClub}` : ""}`).join(", ") || "—"}`,
    `Historic leaking (${audit.historicLeaking.length}): ${audit.historicLeaking.map((p) => p.name).join(", ") || "—"}`,
    `Duplicates (${audit.duplicateGroups.length}): ${audit.duplicateGroups.map((g) => g.players.map((p) => p.name).join(" / ")).join("; ") || "—"}`,
    `Reversed names (${audit.reversedNames.length}): ${audit.reversedNames.map((p) => `${p.name} → ${p.suggestedName}`).join(", ") || "—"}`,
  ];
  return lines.join("\n");
}
