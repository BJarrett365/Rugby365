import type { BioVerificationReport, PlayerBioPacket } from "./player-bio-types";

export function buildBioVerificationReport(packet: PlayerBioPacket): BioVerificationReport {
  const sourceFieldsUsed = [
    packet.name ? "name" : null,
    packet.position ? "position" : null,
    packet.currentClub ? "currentClub" : null,
    packet.nationality ? "nationality" : null,
    packet.birthDate ? "birthDate" : null,
    packet.heightCm ? "heightCm" : null,
    packet.weightKg ? "weightKg" : null,
    packet.seasonStats.length ? "seasonStats" : null,
    packet.recentMatches.length ? "recentMatches" : null,
    packet.transferHistory.length ? "transferHistory" : null,
    packet.rating.displayRating != null ? "playerRating" : null,
    packet.rating.ratingExplanation ? "ratingExplanation" : null,
    packet.legends.length ? "legends" : null,
  ].filter((field): field is string => Boolean(field));

  const suggestedEditorAction =
    packet.conflicts.length > 0
      ? "Resolve conflicting source fields before publishing."
      : packet.missingFields.some((field) => field.importance === "high")
        ? "Fill high-importance missing fields or approve bio with explicit limited-data wording."
        : packet.rating.ratingConfidence != null && packet.rating.ratingConfidence < 0.45
          ? "Review limited-data wording before publishing."
          : "Review suggested bio and approve, edit, or reject.";

  const summary = [
    `Verification for ${packet.name}.`,
    `${sourceFieldsUsed.length} source fields used.`,
    `${packet.missingFields.length} missing fields.`,
    `${packet.conflicts.length} conflicts.`,
    `Confidence ${Math.round(packet.confidenceScore * 100)}%.`,
  ].join(" ");

  return {
    sourceFieldsUsed,
    sourceUrls: packet.sourceUrls,
    missingFields: packet.missingFields,
    conflictingFields: packet.conflicts,
    confidenceScore: packet.confidenceScore,
    suggestedEditorAction,
    summary,
  };
}

export function mergeBioVerificationReport(
  ruleReport: BioVerificationReport,
  aiReport: Partial<BioVerificationReport>,
): BioVerificationReport {
  return {
    sourceFieldsUsed: [...new Set([...ruleReport.sourceFieldsUsed, ...(aiReport.sourceFieldsUsed ?? [])])],
    sourceUrls: mergeUrls(ruleReport.sourceUrls, aiReport.sourceUrls ?? []),
    missingFields: mergeMissing(ruleReport.missingFields, aiReport.missingFields ?? []),
    conflictingFields: [...ruleReport.conflictingFields, ...(aiReport.conflictingFields ?? [])],
    confidenceScore: aiReport.confidenceScore ?? ruleReport.confidenceScore,
    suggestedEditorAction: aiReport.suggestedEditorAction ?? ruleReport.suggestedEditorAction,
    summary: aiReport.summary ?? ruleReport.summary,
  };
}

function mergeUrls(
  left: BioVerificationReport["sourceUrls"],
  right: BioVerificationReport["sourceUrls"],
) {
  const map = new Map(left.map((item) => [item.url, item]));
  for (const item of right) map.set(item.url, item);
  return [...map.values()];
}

function mergeMissing(
  left: BioVerificationReport["missingFields"],
  right: BioVerificationReport["missingFields"],
) {
  const map = new Map(left.map((item) => [item.field, item]));
  for (const item of right) map.set(item.field, item);
  return [...map.values()];
}
