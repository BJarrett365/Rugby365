import type { TransferMovementType } from "./transfer-types";

export const PLAYER_CAREER_STATUSES = ["active", "released", "retired", "legend"] as const;
export type PlayerCareerStatus = (typeof PLAYER_CAREER_STATUSES)[number];

export const PLAYER_CAREER_STATUS_LABELS: Record<PlayerCareerStatus, string> = {
  active: "Active",
  released: "Released",
  retired: "Retired",
  legend: "Legend",
};

export function careerStatusLabel(status: string | null | undefined): string {
  if (!status) return PLAYER_CAREER_STATUS_LABELS.active;
  return PLAYER_CAREER_STATUS_LABELS[status as PlayerCareerStatus] ?? status;
}

export function normalizePlayerCareerStatus(value: string | null | undefined): PlayerCareerStatus {
  const normalized = (value ?? "").trim().toLowerCase();
  if ((PLAYER_CAREER_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as PlayerCareerStatus;
  }
  if (normalized === "release") return "released";
  if (normalized === "retirement") return "retired";
  return "active";
}

export function movementTypeToCareerStatus(
  movementType: TransferMovementType | string | null | undefined,
): PlayerCareerStatus | null {
  switch (movementType) {
    case "released":
      return "released";
    case "retirement":
      return "retired";
    case "permanent":
    case "loan":
    case "contract_extension":
    case "academy_promotion":
      return "active";
    default:
      return null;
  }
}

export type ParsedPlayerName = {
  name: string;
  statusHint: PlayerCareerStatus | null;
};

const CAREER_STATUS_SUFFIX_RE = /\s*\(?\s*(released|retired)\s*\)?\s*$/i;

/** Strip Wikipedia debris and optional (released)/(retired) suffix from a raw player label. */
export function parsePlayerNameAndStatus(raw: string): ParsedPlayerName {
  let cleaned = raw.trim();
  cleaned = cleaned.split(/<ref\b/i)[0]!.split("{{")[0]!.trim();

  let statusHint: PlayerCareerStatus | null = null;
  const statusMatch = cleaned.match(CAREER_STATUS_SUFFIX_RE);
  if (statusMatch) {
    statusHint = statusMatch[1]!.toLowerCase() === "released" ? "released" : "retired";
    cleaned = cleaned.replace(CAREER_STATUS_SUFFIX_RE, "").trim();
  }

  return { name: cleaned, statusHint };
}

export function playerNameNeedsWikiCleanup(value: string): boolean {
  if (!value) return false;
  const parsed = parsePlayerNameAndStatus(value);
  return (
    value.includes("{{") ||
    value.includes("<ref") ||
    value.includes("|url=") ||
    value.includes("cite web") ||
    parsed.name !== value.trim() ||
    CAREER_STATUS_SUFFIX_RE.test(value)
  );
}
