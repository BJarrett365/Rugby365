import {
  resolveTransferSourceConfidence,
  type TransferSourceConfidence,
} from "./transfer-source-utils";

export const TRANSFER_AUDIT_STATUSES = [
  "confirmed",
  "needs_review",
  "missing_source",
  "missing_club_out",
  "missing_club_in",
  "date_missing",
  "duplicate",
] as const;

export type TransferAuditStatus = (typeof TRANSFER_AUDIT_STATUSES)[number];

export type TransferAuditInput = {
  id: string;
  playerId: string;
  movementType: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromClub: string | null;
  toClub: string | null;
  effectiveDate: Date | string | null;
  sourceProvider: string;
  sourceUrl: string | null;
  importKey: string | null;
  seasonId: string | null;
  playerClubTeamId?: string | null;
  duplicateCount?: number;
};

const RELEASED_TYPES = new Set(["released", "retirement"]);

export function computeTransferAuditStatuses(row: TransferAuditInput): TransferAuditStatus[] {
  const statuses: TransferAuditStatus[] = [];
  const confidence = resolveTransferSourceConfidence(row);

  if (
    !row.sourceProvider ||
    row.sourceProvider === "unknown" ||
    (row.sourceProvider !== "manual" && !row.sourceUrl?.trim())
  ) {
    statuses.push("missing_source");
  }

  if (!row.effectiveDate) {
    statuses.push("date_missing");
  }

  if (!RELEASED_TYPES.has(row.movementType) && !row.fromTeamId && !row.fromClub?.trim()) {
    statuses.push("missing_club_out");
  }

  if (!RELEASED_TYPES.has(row.movementType) && !row.toTeamId && !row.toClub?.trim()) {
    statuses.push("missing_club_in");
  }

  if ((row.duplicateCount ?? 0) > 1) {
    statuses.push("duplicate");
  }

  const clubConflict =
    row.toTeamId &&
    row.playerClubTeamId &&
    row.toTeamId !== row.playerClubTeamId &&
    !RELEASED_TYPES.has(row.movementType);

  if (clubConflict || confidence === "low") {
    statuses.push("needs_review");
  }

  if (statuses.length === 0) {
    statuses.push("confirmed");
  }

  return statuses;
}

export function transferAuditStatusLabel(status: TransferAuditStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "needs_review":
      return "Needs review";
    case "missing_source":
      return "Missing source";
    case "missing_club_out":
      return "Missing club out";
    case "missing_club_in":
      return "Missing club in";
    case "date_missing":
      return "Date missing";
    case "duplicate":
      return "Duplicate";
    default:
      return status;
  }
}

export function transferAuditBadgeClass(status: TransferAuditStatus): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-800/60";
    case "needs_review":
      return "bg-amber-500/15 text-amber-300 border-amber-800/60";
    case "missing_source":
    case "date_missing":
      return "bg-orange-500/15 text-orange-300 border-orange-800/60";
    case "missing_club_out":
    case "missing_club_in":
      return "bg-violet-500/15 text-violet-300 border-violet-800/60";
    case "duplicate":
      return "bg-red-500/15 text-red-300 border-red-800/60";
    default:
      return "bg-zinc-800 text-zinc-400 border-zinc-700";
  }
}

export function transferConfidenceBadgeClass(confidence: TransferSourceConfidence): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-500/10 text-emerald-400";
    case "medium":
      return "bg-amber-500/10 text-amber-400";
    case "low":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-500";
  }
}
