import type { TransferListFilters, TransferMovementType } from "./transfer-types";

export function parseTransferListFilters(searchParams: URLSearchParams): TransferListFilters {
  const sourceConfidence = searchParams.get("sourceConfidence");
  const teamDirection = searchParams.get("teamDirection");

  return {
    seasonId: searchParams.get("seasonId") ?? undefined,
    competitionId: searchParams.get("competitionId") ?? undefined,
    teamId: searchParams.get("teamId") ?? undefined,
    teamDirection:
      teamDirection === "in" || teamDirection === "out" || teamDirection === "current"
        ? teamDirection
        : undefined,
    playerId: searchParams.get("playerId") ?? undefined,
    movementType: (searchParams.get("movementType") as TransferMovementType | null) ?? undefined,
    transferType:
      searchParams.get("transferType") === "international"
        ? "international"
        : searchParams.get("transferType") === "club"
          ? "club"
          : undefined,
    sourceKey: searchParams.get("sourceKey") ?? undefined,
    sourceConfidence:
      sourceConfidence === "high" || sourceConfidence === "medium" || sourceConfidence === "low"
        ? sourceConfidence
        : undefined,
    auditStatus: searchParams.get("auditStatus") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    sortBy: (searchParams.get("sortBy") as TransferListFilters["sortBy"]) ?? undefined,
    sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
  };
}
