/** Shared helpers for coach career record visibility / overview labels. */

const PUBLIC_STATUSES = new Set(["verified", "editor_approved"]);

export function isPublicCareerRecord(input: {
  recordStatus?: string | null;
  verifiedAt?: string | Date | null;
}): boolean {
  const status = (input.recordStatus || "").toLowerCase();
  if (PUBLIC_STATUSES.has(status)) return true;
  // Back-compat: legacy rows with verifiedAt but pre-status migration
  return Boolean(input.verifiedAt);
}

export function overviewRoleLabel(input: {
  overviewLabel?: string | null;
  roleLabel: string;
  role?: string;
  careerType?: string;
  teamName?: string;
}): string {
  if (input.overviewLabel?.trim()) return input.overviewLabel.trim();
  return input.roleLabel;
}

export function overviewTeamName(input: {
  teamDisplayName?: string | null;
  teamName: string;
}): string {
  return input.teamDisplayName?.trim() || input.teamName;
}
