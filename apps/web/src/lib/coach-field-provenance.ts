/**
 * Field provenance for coach profile classifications.
 * Rugby365 assessments must never be shown as sourced facts.
 */
export const COACH_FIELD_PROVENANCE = [
  "verified_fact",
  "rugby365_assessment",
  "unverified",
] as const;

export type CoachFieldProvenance = (typeof COACH_FIELD_PROVENANCE)[number];

export function normalizeCoachFieldProvenance(value: unknown): CoachFieldProvenance {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "verified_fact" || v === "verified" || v === "fact") return "verified_fact";
  if (v === "rugby365_assessment" || v === "assessment" || v === "r365") {
    return "rugby365_assessment";
  }
  return "unverified";
}

export function coachFieldProvenanceLabel(value: CoachFieldProvenance): string {
  if (value === "verified_fact") return "Verified fact";
  if (value === "rugby365_assessment") return "Rugby365 assessment";
  return "Unverified";
}

export function isCoachAssessment(value: CoachFieldProvenance | null | undefined): boolean {
  return value === "rugby365_assessment";
}
