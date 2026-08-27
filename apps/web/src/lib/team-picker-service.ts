import { asc, eq, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  standingRows,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  isJunkTeamPickerName,
  sanitizeTeamDisplayName,
} from "./transfer-display";
import { normalizedEntityKey } from "./entity-normalize";
import {
  buildTeamPickerGroups,
  type TeamCompetitionLink,
  type TeamPickerGroup,
  type TeamPickerTeam,
} from "./team-picker-groups";

export type TeamPickerPayload = {
  teams: TeamPickerTeam[];
  groups: TeamPickerGroup[];
  links: TeamCompetitionLink[];
  competitions: Array<{
    id: string;
    name: string;
    slug: string;
    competitionType: string;
  }>;
};

export type TeamPickerQuery = {
  competitionId?: string;
  seasonId?: string;
};

function normalizePickerTeams(teamRows: TeamPickerTeam[]): TeamPickerTeam[] {
  const byKey = new Map<string, TeamPickerTeam>();
  for (const row of teamRows) {
    const displayName = sanitizeTeamDisplayName(row.name) ?? row.name.trim();
    if (isJunkTeamPickerName(displayName)) continue;
    const key = normalizedEntityKey(displayName, "team");
    if (!key) continue;
    const candidate = { ...row, name: displayName };
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    const score = (team: TeamPickerTeam) =>
      (team.name === displayName ? 2 : 0) + (team.slug.length < 48 ? 1 : 0);
    if (score(candidate) > score(existing)) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTeamPickerData(query?: TeamPickerQuery): Promise<TeamPickerPayload> {
  if (query?.competitionId && query?.seasonId) {
    const { listSeasonScopedTeams } = await import("./season-scoped-picker-service");
    const scoped = await listSeasonScopedTeams({
      competitionId: query.competitionId,
      seasonId: query.seasonId,
    });
    return {
      teams: scoped.teams,
      groups: scoped.groups,
      links: scoped.teams.map((team) => ({
        teamId: team.id,
        competitionId: scoped.competition.id,
        competitionName: scoped.competition.name,
        competitionType: scoped.competition.competitionType,
        competitionSlug: scoped.competition.slug,
      })),
      competitions: [scoped.competition],
    };
  }

  const db = getDb();

  const [teamRows, competitionRows, standingLinks, fixtureLinks] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        shortName: teams.shortName,
        countryName: teams.countryName,
      })
      .from(teams)
      .orderBy(asc(teams.name)),
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
        competitionType: competitions.competitionType,
      })
      .from(competitions)
      .orderBy(asc(competitions.name)),
    db
      .select({
        teamId: standingRows.teamId,
        competitionId: competitionSeasons.competitionId,
        competitionName: competitions.name,
        competitionType: competitions.competitionType,
        competitionSlug: competitions.slug,
      })
      .from(standingRows)
      .innerJoin(competitionSeasons, eq(standingRows.seasonId, competitionSeasons.id))
      .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id)),
    // Distinct team/competition pairs only — pulling every fixture row (~37k after
    // the 1987 backfill) saturates the 4-connection pool and stalls CMS list pages.
    db.execute<{ team_id: string; competition_id: string }>(sql`
      SELECT home_team_id AS team_id, competition_id
      FROM fixtures
      WHERE home_team_id IS NOT NULL AND competition_id IS NOT NULL
      UNION
      SELECT away_team_id, competition_id
      FROM fixtures
      WHERE away_team_id IS NOT NULL AND competition_id IS NOT NULL
    `),
  ]);

  const compById = new Map(competitionRows.map((row) => [row.id, row]));
  const linkKey = (teamId: string, competitionId: string) => `${teamId}:${competitionId}`;
  const linkMap = new Map<string, TeamCompetitionLink>();

  for (const row of standingLinks) {
    linkMap.set(linkKey(row.teamId, row.competitionId), {
      teamId: row.teamId,
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      competitionType: row.competitionType,
      competitionSlug: row.competitionSlug,
    });
  }

  for (const row of fixtureLinks) {
    if (!row.competition_id || !row.team_id) continue;
    const meta = compById.get(row.competition_id);
    if (!meta) continue;
    linkMap.set(linkKey(row.team_id, row.competition_id), {
      teamId: row.team_id,
      competitionId: row.competition_id,
      competitionName: meta.name,
      competitionType: meta.competitionType,
      competitionSlug: meta.slug,
    });
  }

  const links = [...linkMap.values()];
  const normalizedTeams = normalizePickerTeams(teamRows);
  const normalizedTeamIds = new Set(normalizedTeams.map((team) => team.id));
  const normalizedLinks = links.filter((link) => normalizedTeamIds.has(link.teamId));
  const groups = buildTeamPickerGroups(normalizedTeams, normalizedLinks, competitionRows);

  return {
    teams: normalizedTeams,
    groups,
    links: normalizedLinks,
    competitions: competitionRows,
  };
}
