const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type FixtureSlugFormat = "teams-date" | "teams" | "competition-teams-date" | "competition-teams";

export const FIXTURE_SLUG_FORMAT_OPTIONS: Array<{
  value: FixtureSlugFormat;
  label: string;
  example: string;
}> = [
  {
    value: "teams-date",
    label: "Teams + date",
    example: "new-zealand-v-italy-2026-07-11",
  },
  {
    value: "competition-teams-date",
    label: "Competition + teams + date",
    example: "international-matches-new-zealand-v-italy-2026-07-11",
  },
  {
    value: "competition-teams",
    label: "Competition + teams",
    example: "international-matches-new-zealand-v-italy",
  },
  {
    value: "teams",
    label: "Teams only",
    example: "new-zealand-v-italy",
  },
];

export function buildFixtureSlug(input: {
  homeSlug: string;
  awaySlug: string;
  kickoffAt?: string | null;
  competitionName?: string | null;
  format?: FixtureSlugFormat;
}): string {
  const format = input.format ?? "teams-date";
  const home = normalizeSlug(input.homeSlug);
  const away = normalizeSlug(input.awaySlug);
  const date = input.kickoffAt ? String(input.kickoffAt).slice(0, 10) : "";
  const competition = input.competitionName ? normalizeSlug(input.competitionName) : "";
  const teamsPart = `${home}-v-${away}`;

  switch (format) {
    case "teams":
      return normalizeSlug(teamsPart);
    case "teams-date":
      return normalizeSlug(date ? `${teamsPart}-${date}` : teamsPart);
    case "competition-teams":
      return normalizeSlug(competition ? `${competition}-${teamsPart}` : teamsPart);
    case "competition-teams-date":
      if (competition && date) return normalizeSlug(`${competition}-${teamsPart}-${date}`);
      if (competition) return normalizeSlug(`${competition}-${teamsPart}`);
      return normalizeSlug(date ? `${teamsPart}-${date}` : teamsPart);
    default:
      return normalizeSlug(teamsPart);
  }
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (!SLUG_RE.test(slug)) return "Slug must be lowercase letters, numbers and hyphens only";
  if (slug.length > 80) return "Slug is too long";
  return null;
}
