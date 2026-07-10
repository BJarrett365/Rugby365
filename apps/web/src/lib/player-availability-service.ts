import {
  ACTIVE_INJURY_STATUSES,
  ACTIVE_SUSPENSION_STATUSES,
} from "./availability-types";
import { listInjuries, type InjuryRow } from "./injury-admin-service";
import {
  buildPlayerAvailabilityContext,
  type PlayerAvailabilityContext,
} from "./player-availability-intelligence";
import { listSuspensions, type SuspensionRow } from "./suspension-admin-service";

export type AvailabilityDashboard = {
  injured: InjuryRow[];
  doubtful: InjuryRow[];
  suspended: SuspensionRow[];
  expectedBackSoon: InjuryRow[];
  recentlyReturned: InjuryRow[];
  unavailablePlayers: Array<{
    playerId: string;
    playerName: string;
    teamName: string | null;
    reason: string;
    kind: "injury" | "suspension";
    expectedReturnDate: string | null;
  }>;
};

export async function getPlayerAvailabilityContext(playerId: string): Promise<PlayerAvailabilityContext> {
  const [injuries, suspensions] = await Promise.all([
    listInjuries({ playerId }),
    listSuspensions({ playerId }),
  ]);

  return buildPlayerAvailabilityContext({
    injuries: injuries.map((row) => ({
      id: row.id,
      status: row.status,
      injuryType: row.injuryType,
      bodyArea: row.bodyArea,
      injuryDate: row.injuryDate,
      expectedReturnDate: row.expectedReturnDate,
      actualReturnDate: row.actualReturnDate,
      matchesMissed: row.matchesMissed,
    })),
    suspensions: suspensions.map((row) => ({
      id: row.id,
      status: row.status,
      offence: row.offence,
      cardType: row.cardType,
      fixtureId: row.fixtureId,
      suspensionStart: row.suspensionStart,
      suspensionEnd: row.suspensionEnd,
      matchesRemaining: row.matchesRemaining,
    })),
  });
}

export async function getTeamAvailabilitySummary(teamId: string) {
  const injuries = await listInjuries({ teamId, limit: 100 });
  const suspensions = await listSuspensions({ teamId, limit: 100 });
  return {
    currentInjuries: injuries.filter((row) => ACTIVE_INJURY_STATUSES.includes(row.status)),
    currentSuspensions: suspensions.filter((row) => ACTIVE_SUSPENSION_STATUSES.includes(row.status)),
    expectedReturns: injuries.filter((row) => row.expectedReturnDate && row.status !== "returned"),
    recentlyReturned: injuries.filter(
      (row) => row.status === "returned" || row.status === "return_to_training",
    ),
  };
}

export async function getAvailabilityDashboard(filters: {
  teamId?: string;
  seasonId?: string;
  competitionId?: string;
} = {}): Promise<AvailabilityDashboard> {
  const injuries = await listInjuries({ ...filters, limit: 300 });
  const suspensions = await listSuspensions({ ...filters, limit: 300 });

  const injured = injuries.filter((row) =>
    ["injured", "long_term_injury", "in_rehabilitation"].includes(row.status),
  );
  const doubtful = injuries.filter((row) => row.status === "doubtful");
  const suspended = suspensions.filter((row) => ACTIVE_SUSPENSION_STATUSES.includes(row.status));
  const expectedBackSoon = injuries.filter(
    (row) => row.expectedReturnDate && ["injured", "in_rehabilitation", "doubtful"].includes(row.status),
  );
  const recentlyReturned = injuries.filter(
    (row) => row.status === "returned" || row.status === "return_to_training",
  );

  const unavailablePlayers = [
    ...injured.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      reason: row.injuryType ?? row.status,
      kind: "injury" as const,
      expectedReturnDate: row.expectedReturnDate,
    })),
    ...doubtful.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      reason: "Doubtful",
      kind: "injury" as const,
      expectedReturnDate: row.expectedReturnDate,
    })),
    ...suspended.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      reason: row.offence ?? row.status,
      kind: "suspension" as const,
      expectedReturnDate: row.suspensionEnd,
    })),
  ];

  return { injured, doubtful, suspended, expectedBackSoon, recentlyReturned, unavailablePlayers };
}
