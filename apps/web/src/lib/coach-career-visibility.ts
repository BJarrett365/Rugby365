/** Shared helpers for coach career record visibility / overview labels. */

const PUBLIC_STATUSES = new Set(["verified", "editor_approved"]);

export const COACH_NATION_NAME =
  /ireland|england|wales|scotland|france|italy|south africa|springbok|new zealand|all black|australia|wallab|argentina|puma|japan|fiji|georgia|samoa|tonga|namibia|uruguay|chile|canada|united states|usa\b|romania|portugal|spain|lions|national/;

export function isPublicCareerRecord(input: {
  recordStatus?: string | null;
  verifiedAt?: string | Date | null;
}): boolean {
  const status = (input.recordStatus || "").toLowerCase();
  if (PUBLIC_STATUSES.has(status)) return true;
  // Back-compat: legacy rows with verifiedAt but pre-status migration
  return Boolean(input.verifiedAt);
}

export function isPublicHistoryAssignment(input: {
  recordStatus?: string | null;
  verifiedAt?: string | Date | null;
  isCurrent?: boolean;
  showOnOverview?: boolean;
  startDate?: string | null;
}): boolean {
  if ((input.recordStatus || "").toLowerCase() === "conflict") return false;
  if (input.isCurrent || input.showOnOverview) return true;
  if (isPublicCareerRecord(input)) return true;
  return Boolean(input.startDate);
}

export function teamNameFromAssignmentBio(bioSummary?: string | null): string | null {
  if (!bioSummary?.trim()) return null;
  const match = bioSummary.match(/·\s*(.+)$/);
  if (!match?.[1]) return null;
  const name = match[1].replace(/\s*\([^)]+\)\s*$/, "").trim();
  if (!name || /^unknown team/i.test(name)) return null;
  return name;
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
  bioSummary?: string | null;
}): string {
  const display = input.teamDisplayName?.trim();
  if (display) return display;
  if (/^unknown team/i.test(input.teamName)) {
    return teamNameFromAssignmentBio(input.bioSummary) || input.teamName;
  }
  return input.teamName;
}
