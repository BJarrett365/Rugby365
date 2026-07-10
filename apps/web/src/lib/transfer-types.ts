export const TRANSFER_MOVEMENT_TYPES = [
  "permanent",
  "loan",
  "contract_extension",
  "released",
  "academy_promotion",
  "retirement",
  "unknown",
] as const;

export type TransferMovementType = (typeof TRANSFER_MOVEMENT_TYPES)[number];

export const TRANSFER_SCOPE_TYPES = ["club", "international"] as const;
export type TransferScopeType = (typeof TRANSFER_SCOPE_TYPES)[number];

export type TransferListFilters = {
  seasonId?: string;
  competitionId?: string;
  teamId?: string;
  teamDirection?: "in" | "out" | "current";
  playerId?: string;
  movementType?: TransferMovementType;
  transferType?: TransferScopeType;
  sourceKey?: string;
  sourceConfidence?: "high" | "medium" | "low";
  auditStatus?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "effectiveDate" | "playerName" | "createdAt";
  sortDir?: "asc" | "desc";
};

export type TransferImportSummary = {
  newPlayers: number;
  existingPlayersLinked: number;
  transfersAdded: number;
  transfersUpdated: number;
  teamsMapped: number;
  warnings: string[];
  errors: string[];
  pendingPlayerMatches: Array<{
    importKey: string;
    playerName: string;
    candidates: Array<{ id: string; name: string; score: number }>;
  }>;
};

export type PlayerMatchCandidate = {
  id: string;
  name: string;
  score: number;
  birthDate: string | null;
  nationCode: string | null;
  clubTeamName: string | null;
  positionName: string | null;
  reasons: string[];
};

export type TeamMatchResult = {
  teamId: string | null;
  teamName: string | null;
  matched: boolean;
  inputName: string;
};

export function movementTypeLabel(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
