import {
  nationsChampionshipHemisphereForTeam,
  NATIONS_CHAMPIONSHIP_COMPETITION_SLUG,
} from "./nations-championship-hemisphere";

export type TeamPickerTeam = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  countryName?: string | null;
};

export type TeamPickerGroup = {
  id: string;
  label: string;
  teams: TeamPickerTeam[];
};

export type TeamCompetitionLink = {
  teamId: string;
  competitionId: string;
  competitionName: string;
  competitionType: string;
  competitionSlug: string;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
};

type CompetitionMeta = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
};

const COMPETITION_ORDER = [
  "premiership",
  "top-14",
  "united-rugby-championship",
  "rugby-championship",
  "rugby-champions-cup",
  "challenge-cup",
  "six-nations",
  "nations-championship",
  "rugby-world-cup",
] as const;

const NORTHERN_INTERNATIONAL_SLUGS = new Set(["six-nations"]);
const SOUTHERN_INTERNATIONAL_SLUGS = new Set(["rugby-championship"]);

const NORTHERN_HEMISPHERE_TEAMS = new Set([
  "england",
  "scotland",
  "wales",
  "ireland",
  "france",
  "italy",
  "georgia",
  "romania",
  "portugal",
  "spain",
  "usa",
  "united states",
  "canada",
  "japan",
  "russia",
  "netherlands",
  "germany",
  "belgium",
  "switzerland",
]);

const SOUTHERN_HEMISPHERE_TEAMS = new Set([
  "south africa",
  "new zealand",
  "australia",
  "argentina",
  "fiji",
  "samoa",
  "tonga",
  "namibia",
  "zimbabwe",
  "chile",
  "uruguay",
]);

function teamKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rugbyHemisphereForTeam(name: string): "northern" | "southern" | null {
  const key = teamKey(name);
  if (NORTHERN_HEMISPHERE_TEAMS.has(key)) return "northern";
  if (SOUTHERN_HEMISPHERE_TEAMS.has(key)) return "southern";
  return null;
}

function isInternationalCompetition(meta: CompetitionMeta): boolean {
  if (meta.competitionType === "international" || meta.competitionType === "world_cup") return true;
  if (NORTHERN_INTERNATIONAL_SLUGS.has(meta.slug) || SOUTHERN_INTERNATIONAL_SLUGS.has(meta.slug)) {
    return true;
  }
  return false;
}

function competitionSortIndex(slug: string): number {
  const idx = COMPETITION_ORDER.indexOf(slug as (typeof COMPETITION_ORDER)[number]);
  return idx >= 0 ? idx : 100 + slug.localeCompare("");
}

function groupLabelForInternational(hemisphere: "northern" | "southern"): string {
  return hemisphere === "northern"
    ? "Internationals — Northern Hemisphere"
    : "Internationals — Southern Hemisphere";
}

function primaryGroupKeyForTeam(
  team: TeamPickerTeam,
  links: TeamCompetitionLink[],
  compById: Map<string, CompetitionMeta>,
): string {
  const teamLinks = links.filter((link) => link.teamId === team.id);
  const clubLinks = teamLinks.filter((link) => {
    const meta = compById.get(link.competitionId);
    return meta && !isInternationalCompetition(meta);
  });

  if (clubLinks.length > 0) {
    const sorted = [...clubLinks].sort((a, b) => {
      const aMeta = compById.get(a.competitionId);
      const bMeta = compById.get(b.competitionId);
      const aIdx = aMeta ? competitionSortIndex(aMeta.slug) : 999;
      const bIdx = bMeta ? competitionSortIndex(bMeta.slug) : 999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.competitionName.localeCompare(b.competitionName);
    });
    return `club:${sorted[0]!.competitionId}`;
  }

  const intlLinks = teamLinks.filter((link) => {
    const meta = compById.get(link.competitionId);
    return meta && isInternationalCompetition(meta);
  });
  if (intlLinks.length > 0 || rugbyHemisphereForTeam(team.name)) {
    const nationsLink = intlLinks.find(
      (link) => link.competitionSlug === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG,
    );
    if (nationsLink) {
      const nationsHemisphere = nationsChampionshipHemisphereForTeam(team.name);
      if (nationsHemisphere) return `intl:${nationsHemisphere}`;
    }

    const hemisphere =
      rugbyHemisphereForTeam(team.name) ??
      (intlLinks.some((link) => SOUTHERN_INTERNATIONAL_SLUGS.has(link.competitionSlug))
        ? "southern"
        : intlLinks.some((link) => NORTHERN_INTERNATIONAL_SLUGS.has(link.competitionSlug))
          ? "northern"
          : null);
    if (hemisphere) return `intl:${hemisphere}`;
  }

  return "other";
}

function groupLabelForKey(key: string, compById: Map<string, CompetitionMeta>): string {
  if (key.startsWith("club:")) {
    const compId = key.slice(5);
    return compById.get(compId)?.name ?? "Other competitions";
  }
  if (key === "intl:northern") return groupLabelForInternational("northern");
  if (key === "intl:southern") return groupLabelForInternational("southern");
  return "Other teams";
}

function groupSortIndex(key: string, compById: Map<string, CompetitionMeta>): number {
  if (key.startsWith("club:")) {
    const meta = compById.get(key.slice(5));
    return meta ? competitionSortIndex(meta.slug) : 200;
  }
  if (key === "intl:northern") return 50;
  if (key === "intl:southern") return 51;
  return 999;
}

export function buildTeamPickerGroups(
  teams: TeamPickerTeam[],
  links: TeamCompetitionLink[],
  competitions: CompetitionSummary[],
): TeamPickerGroup[] {
  const compById = new Map<string, CompetitionMeta>(
    competitions.map((c) => [c.id, c]),
  );

  const buckets = new Map<string, TeamPickerTeam[]>();
  for (const team of teams) {
    const key = primaryGroupKeyForTeam(team, links, compById);
    const bucket = buckets.get(key) ?? [];
    bucket.push(team);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const diff = groupSortIndex(a, compById) - groupSortIndex(b, compById);
      if (diff !== 0) return diff;
      return groupLabelForKey(a, compById).localeCompare(groupLabelForKey(b, compById));
    })
    .map(([key, bucketTeams]) => ({
      id: key,
      label: groupLabelForKey(key, compById),
      teams: [...bucketTeams].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function teamPrimaryCompetitionId(
  teamId: string,
  links: TeamCompetitionLink[],
  competitions: CompetitionSummary[],
): string | null {
  const team = { id: teamId, name: "", slug: "" };
  const compById = new Map(competitions.map((c) => [c.id, c]));
  const key = primaryGroupKeyForTeam(team, links, compById);
  if (!key.startsWith("club:")) return null;
  return key.slice(5);
}

export function listCompetitionFilterOptions(
  groups: TeamPickerGroup[],
  links: TeamCompetitionLink[],
  competitions: CompetitionSummary[],
): Array<{ id: string; label: string }> {
  const usedCompIds = new Set(
    links.map((link) => link.competitionId),
  );
  const intlNorthern = groups.some((g) => g.label === groupLabelForInternational("northern"));
  const intlSouthern = groups.some((g) => g.label === groupLabelForInternational("southern"));

  const options = competitions
    .filter((c) => usedCompIds.has(c.id))
    .sort((a, b) => competitionSortIndex(a.slug) - competitionSortIndex(b.slug))
    .map((c) => ({ id: c.id, label: c.name }));

  if (intlNorthern) options.push({ id: "intl:northern", label: groupLabelForInternational("northern") });
  if (intlSouthern) options.push({ id: "intl:southern", label: groupLabelForInternational("southern") });
  if (groups.some((g) => g.label === "Other teams")) {
    options.push({ id: "other", label: "Other teams" });
  }
  return options;
}

export function filterTeamGroupsByCompetition(
  groups: TeamPickerGroup[],
  filterId: string,
  links: TeamCompetitionLink[],
  competitions: CompetitionSummary[],
): TeamPickerGroup[] {
  if (!filterId || filterId === "all") return groups;

  if (filterId === "intl:northern") {
    return groups.filter((g) => g.label === groupLabelForInternational("northern"));
  }
  if (filterId === "intl:southern") {
    return groups.filter((g) => g.label === groupLabelForInternational("southern"));
  }
  if (filterId === "other") {
    return groups.filter((g) => g.label === "Other teams");
  }

  const comp = competitions.find((c) => c.id === filterId);
  if (!comp) return groups;
  const teamIds = new Set(links.filter((l) => l.competitionId === filterId).map((l) => l.teamId));
  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      teams: group.teams.filter((team) => teamIds.has(team.id)),
    }))
    .filter((group) => group.teams.length > 0);
}
