import type { PersonIntelligencePacket, PersonVerificationReport } from "./person-intelligence-types";

export function buildPersonVerificationReport(packet: PersonIntelligencePacket): PersonVerificationReport {
  const sourceFieldsUsed = [
    packet.name ? "name" : null,
    packet.currentRole ? "currentRole" : null,
    packet.currentOrganisation ? "currentOrganisation" : null,
    packet.nationality ? "nationality" : null,
    packet.score.explanation ? "scoreExplanation" : null,
  ].filter((field): field is string => Boolean(field));

  const suggestedEditorAction =
    packet.conflicts.length > 0
      ? "Resolve conflicting source fields before publishing."
      : packet.missingFields.some((field) => field.importance === "high")
        ? "Fill high-importance missing fields or approve with limited-data wording."
        : packet.roleType === "referee"
          ? "Review referee bio for respectful public wording before publishing."
          : "Review suggested bio and approve, edit, or reject.";

  return {
    sourceFieldsUsed,
    sourceUrls: packet.sourceUrls,
    missingFields: packet.missingFields,
    conflictingFields: packet.conflicts,
    confidenceScore: packet.confidenceScore,
    suggestedEditorAction,
    summary: `Verification for ${packet.name} (${packet.roleType}).`,
  };
}
