import { and, asc, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerSeasonStats,
  players,
  standingRows,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeTeamName, isJunkTeamSlug } from "./entity-normalize";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";
import { kickoffInSeason } from "./season-label-utils";
import { canonicalPremiershipTeamName } from "./transfer-match-service";
import {
  buildTeamPickerGroups,
  type TeamCompetitionLink,
  type TeamPickerGroup,
  type TeamPickerTeam,
} from "./team-picker-groups";

export type SeasonScopedPickerFilters = {
  competitionId: string;
  seasonId: string;
};

export type SeasonScopedTeamRow = TeamPickerTeam & {
  canonicalName: string;
  source: "standings" | "fixtures";
};

export type SeasonScopedPlayerRow = {
  id: string;
  name: string;
  clubTeamName: string | null;
  positionName: string | null;
};

/** Canonical display/dedupe key for teams within a competition season. */
export function canonicalTeamIdentityKey(competitionSlug: string, teamName: string): string {
  const normalized =
    competitionSlug === "premiership"
      ? canonicalPremiershipTeamName(teamName)
      : normalizeTeamName(teamName);
  return normalized.trim().toLowerCase();
}

export function canonicalTeamDisplayName(competitionSlug: string, teamName: string): string {
  if (competitionSlug === "premiership") {
    return canonicalPremiershipTeamName(teamName);
  }
  return normalizeTeamName(teamName);
}

/** Collapse alias duplicates (e.g. Bristol Rugby + Bristol Bears) to one row per canonical club. */
export function dedupeSeasonTeamsByCanonicalIdentity(
  rows: SeasonScopedTeamRow[],
  competitionSlug: string,
): SeasonScopedTeamRow[] {
  const groups = new Map<string, SeasonScopedTeamRow[]>();
  for (const row of rows) {
    const key = canonicalTeamIdentityKey(competitionSlug, row.name);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const canonicalName = (name: string) => canonicalTeamDisplayName(competitionSlug, name);

  return [...groups.values()].map((candidates) => {
    const sorted = [...candidates].sort((a, b) => {
      const aCanonical = canonicalName(a.name) === a.name ? 1 : 0;
      const bCanonical = canonicalName(b.name) === b.name ? 1 : 0;
      if (bCanonical !== aCanonical) return bCanonical - aCanonical;
      const aAlias = canonicalPremiershipTeamName(a.name) === a.name ? 1 : 0;
      const bAlias = canonicalPremiershipTeamName(b.name) === b.name ? 1 : 0;
      if (bAlias !== aAlias) return bAlias - aAlias;
      const aJunk = isJunkTeamSlug(a.slug) ? 0 : 1;
      const bJunk = isJunkTeamSlug(b.slug) ? 0 : 1;
      if (bJunk !== aJunk) return bJunk - aJunk;
      return a.slug.length - b.slug.length || a.name.localeCompare(b.name);
    });
    const best = sorted[0]!;
    return {
      ...best,
      name: canonicalTeamDisplayName(competitionSlug, best.name),
      canonicalName: canonicalTeamDisplayName(competitionSlug, best.name),
    };
  });
}

export async function resolveSeasonScope(filters: SeasonScopedPickerFilters) {
  const db = getDb();
  const [season] = await db
    .select({
      id: competitionSeasons.id,
      year: competitionSeasons.year,
      label: competitionSeasons.label,
      competitionId: competitionSeasons.competitionId,
      isDeprecated: competitionSeasons.isDeprecated,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, filters.seasonId))
    .limit(1);

  if (!season || season.competitionId !== filters.competitionId) {
    throw new Error("Season does not belong to the selected competition");
  }
  if (season.isDeprecated) {
    throw new Error("Season is deprecated — pick the canonical season row");
  }

  const [competition] = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      competitionType: competitions.competitionType,
    })
    .from(competitions)
    .where(eq(competitions.id, filters.competitionId))
    .limit(1);

  if (!competition) throw new Error("Competition not found");
  if (season.year == null) throw new Error("Season is missing start year");

  return { season, competition };
}

export async function listSeasonScopedTeams(
  filters: SeasonScopedPickerFilters,
): Promise<{
  teams: SeasonScopedTeamRow[];
  groups: TeamPickerGroup[];
  competition: { id: string; name: string; slug: string; competitionType: string };
  season: { id: string; label: string; year: number };
  sources: { standings: number; fixtures: number };
}> {
  const { season, competition } = await resolveSeasonScope(filters);
  const db = getDb();

  const standingTeamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      shortName: teams.shortName,
      countryName: teams.countryName,
    })
    .from(standingRows)
    .innerJoin(teams, eq(standingRows.teamId, teams.id))
    .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));

  let scopedTeams: SeasonScopedTeamRow[] = standingTeamRows.map((row) => ({
    ...row,
    canonicalName: canonicalTeamDisplayName(competition.slug, row.name),
    source: "standings" as const,
  }));

  let fixtureFallbackCount = 0;
  if (scopedTeams.length === 0) {
    const fixtureRows = await db
      .select({
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(fixtures)
      .where(eq(fixtures.competitionId, competition.id));

    const teamIds = new Set<string>();
    for (const row of fixtureRows) {
      if (!kickoffInSeason(row.kickoffAt, season.year!)) continue;
      if (row.homeTeamId) teamIds.add(row.homeTeamId);
      if (row.awayTeamId) teamIds.add(row.awayTeamId);
    }

    if (teamIds.size > 0) {
      const teamRows = await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          shortName: teams.shortName,
          countryName: teams.countryName,
        })
        .from(teams)
        .where(inArray(teams.id, [...teamIds]));

      scopedTeams = teamRows.map((row) => ({
        ...row,
        canonicalName: canonicalTeamDisplayName(competition.slug, row.name),
        source: "fixtures" as const,
      }));
      fixtureFallbackCount = scopedTeams.length;
    }
  }

  let deduped = dedupeSeasonTeamsByCanonicalIdentity(scopedTeams, competition.slug).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Nations Championship is a fixed 12-nation pool — ignore stray fixtures (e.g. Canada).
  if (isNationsChampionshipSlug(competition.slug)) {
    deduped = deduped.filter((team) =>
      Boolean(nationsChampionshipHemisphereForTeam(team.canonicalName || team.name)),
    );
  }

  const links: TeamCompetitionLink[] = deduped.map((team) => ({
    teamId: team.id,
    competitionId: competition.id,
    competitionName: competition.name,
    competitionType: competition.competitionType,
    competitionSlug: competition.slug,
  }));

  const groups = buildTeamPickerGroups(deduped, links, [competition]);

  return {
    teams: deduped,
    groups,
    competition,
    season: { id: season.id, label: season.label, year: season.year! },
    sources: { standings: standingTeamRows.length, fixtures: fixtureFallbackCount },
  };
}

export async function listSeasonScopedPlayers(input: {
  competitionId: string;
  seasonId: string;
  teamId: string;
}): Promise<SeasonScopedPlayerRow[]> {
  const { season } = await resolveSeasonScope({
    competitionId: input.competitionId,
    seasonId: input.seasonId,
  });

  const { listMembershipsForTeamSeason } = await import("./player-membership-service");
  const memberships = await listMembershipsForTeamSeason(input.teamId, season.id, [
    "active",
    "incoming",
    "loan_in",
  ]);
  if (memberships.length > 0) {
    const db = getDb();
    const playerRows = await db
      .select({
        id: players.id,
        name: players.name,
        positionName: players.positionName,
        clubName: players.clubName,
      })
      .from(players)
      .where(inArray(players.id, memberships.map((row) => row.playerId)));

    const byId = new Map(playerRows.map((row) => [row.id, row]));
    return memberships
      .map((member) => {
        const player = byId.get(member.playerId);
        if (!player) return null;
        return {
          id: player.id,
          name: player.name,
          clubTeamName: player.clubName,
          positionName: player.positionName,
        };
      })
      .filter((row): row is SeasonScopedPlayerRow => row != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const db = getDb();

  const statsRows = await db
    .select({
      id: players.id,
      name: players.name,
      positionName: players.positionName,
      clubName: players.clubName,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .where(and(eq(playerSeasonStats.seasonId, season.id), eq(playerSeasonStats.teamId, input.teamId)));

  if (statsRows.length > 0) {
    return statsRows
      .map((row) => ({
        id: row.id,
        name: row.name,
        clubTeamName: row.clubName,
        positionName: row.positionName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { competition } = await resolveSeasonScope({
    competitionId: input.competitionId,
    seasonId: input.seasonId,
  });

  const fixtureRows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixtures)
    .where(eq(fixtures.competitionId, competition.id));

  const fixtureIds = fixtureRows
    .filter((row) => kickoffInSeason(row.kickoffAt, season.year!))
    .map((row) => row.id);

  if (fixtureIds.length === 0) return [];

  const squadRows = await db
    .select({
      id: players.id,
      name: players.name,
      positionName: fixturePlayers.positionName,
      clubName: players.clubName,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(and(eq(fixturePlayers.teamId, input.teamId), inArray(fixturePlayers.fixtureId, fixtureIds)));

  const byPlayer = new Map<string, SeasonScopedPlayerRow>();
  for (const row of squadRows) {
    if (!byPlayer.has(row.id)) {
      byPlayer.set(row.id, {
        id: row.id,
        name: row.name,
        clubTeamName: row.clubName,
        positionName: row.positionName,
      });
    }
  }

  return [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name));
}
