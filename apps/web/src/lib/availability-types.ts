export const INJURY_STATUSES = [
  "doubtful",
  "injured",
  "long_term_injury",
  "in_rehabilitation",
  "return_to_training",
  "available",
  "returned",
] as const;

export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const SUSPENSION_STATUSES = [
  "pending_hearing",
  "suspended",
  "serving_suspension",
  "available_again",
  "overturned",
] as const;

export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];

export const SUSPENSION_CARD_TYPES = ["yellow", "red", "citing", "other"] as const;

export type SuspensionCardType = (typeof SUSPENSION_CARD_TYPES)[number];

export function injuryStatusLabel(status: InjuryStatus): string {
  switch (status) {
    case "doubtful":
      return "Doubtful";
    case "injured":
      return "Injured";
    case "long_term_injury":
      return "Long-Term Injury";
    case "in_rehabilitation":
      return "In Rehabilitation";
    case "return_to_training":
      return "Return to Training";
    case "available":
      return "Available";
    case "returned":
      return "Returned";
    default:
      return status;
  }
}

export function suspensionStatusLabel(status: SuspensionStatus): string {
  switch (status) {
    case "pending_hearing":
      return "Pending Hearing";
    case "suspended":
      return "Suspended";
    case "serving_suspension":
      return "Serving Suspension";
    case "available_again":
      return "Available Again";
    case "overturned":
      return "Overturned";
    default:
      return status;
  }
}

export function normalizeInjuryStatus(value?: string | null): InjuryStatus {
  const normalized = (value ?? "injured").trim().toLowerCase().replace(/\s+/g, "_");
  return (INJURY_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as InjuryStatus)
    : "injured";
}

export function normalizeSuspensionStatus(value?: string | null): SuspensionStatus {
  const normalized = (value ?? "suspended").trim().toLowerCase().replace(/\s+/g, "_");
  return (SUSPENSION_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as SuspensionStatus)
    : "suspended";
}

export function isPlayerUnavailableInjury(status: InjuryStatus): boolean {
  return ["doubtful", "injured", "long_term_injury", "in_rehabilitation"].includes(status);
}

export function isPlayerUnavailableSuspension(status: SuspensionStatus): boolean {
  return ["pending_hearing", "suspended", "serving_suspension"].includes(status);
}

export function isRecentlyReturnedInjury(status: InjuryStatus): boolean {
  return status === "returned" || status === "return_to_training";
}

export const ACTIVE_INJURY_STATUSES: InjuryStatus[] = [
  "doubtful",
  "injured",
  "long_term_injury",
  "in_rehabilitation",
  "return_to_training",
];

export const ACTIVE_SUSPENSION_STATUSES: SuspensionStatus[] = [
  "pending_hearing",
  "suspended",
  "serving_suspension",
];

export function daysBetween(start?: string | null, end?: string | null): number | null {
  if (!start) return null;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

export function sanitizePublicAvailabilityNotes(notes?: string | null): string | null {
  if (!notes?.trim()) return null;
  return notes.trim().slice(0, 2000);
}
