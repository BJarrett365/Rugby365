/**
 * Competition → team → player roster for the public compare picker.
 * Uses standings/fixtures for teams and published club squads for players
 * (not leaderboard stats, which are often empty).
 */
import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, players, teams } from "@rugby365/db";
import { isRealCompareRosterTeamName } from "./compare-roster-team-name";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  getCompetitionStandingsBySlug,
} from "./competition-admin-service";

export type CompareRosterTeam = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
};

export type CompareRosterPlayer = {
  id: string;
  slug: string;
  name: string;
  position: string | null;
  teamId: string;
  teamName: string;
};

export type CompetitionCompareRoster = {
  competition: { id: string; slug: string; name: string };
  teams: CompareRosterTeam[];
  players: CompareRosterPlayer[];
};

export { isRealCompareRosterTeamName } from "./compare-roster-team-name";

function dedupeTeamsById(list: CompareRosterTeam[]): CompareRosterTeam[] {
  const seen = new Set<string>();
  const out: CompareRosterTeam[] = [];
  for (const team of list) {
    if (seen.has(team.id)) continue;
    seen.add(team.id);
    out.push(team);
  }
  return out;
}

async function listTeamsFromFixtures(competitionId: string): Promise<CompareRosterTeam[]> {
  const db = getDb();
  const rows = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      externalMatchId: fixtures.externalMatchId,
      stage: fixtures.stage,
      round: fixtures.round,
    })
    .from(fixtures)
    .where(eq(fixtures.competitionId, competitionId));

  const ids = new Set<string>();
  for (const row of rows) {
    const external = row.externalMatchId ?? "";
    if (
      external.startsWith("rwc-wiki-statistics:") ||
      external.startsWith("rwc-opta-leaderboard:") ||
      row.stage === "stats_seed" ||
      row.round === "stats_seed"
    ) {
      continue;
    }
    if (row.homeTeamId) ids.add(row.homeTeamId);
    if (row.awayTeamId) ids.add(row.awayTeamId);
  }
  if (ids.size === 0) return [];

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      shortName: teams.shortName,
    })
    .from(teams)
    .where(inArray(teams.id, [...ids]))
    .orderBy(asc(teams.name));

  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    shortName: t.shortName ?? null,
  }));
}

export async function getCompetitionCompareRosterBySlug(
  slug: string,
): Promise<CompetitionCompareRoster | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  const standingsData = await getCompetitionStandingsBySlug(competition.slug);
  const standingTeams: CompareRosterTeam[] = (standingsData?.standings ?? [])
    .filter((row) => Boolean(row.teamId && row.teamName))
    .filter((row) => isRealCompareRosterTeamName(row.teamName!))
    .map((row) => ({
      id: row.teamId!,
      name: row.teamName!,
      slug: row.teamSlug ?? row.teamId!,
      shortName: row.teamShortName ?? null,
    }));

  const fixtureTeams = (await listTeamsFromFixtures(competition.id)).filter((t) =>
    isRealCompareRosterTeamName(t.name),
  );

  // Prefer standings when they have real clubs/nations; always merge fixtures so
  // draw placeholders that only appear in one source are filtered consistently,
  // and real nations from fixtures are not dropped when standings are bracket-heavy.
  const teamsList = dedupeTeamsById(
    [...standingTeams, ...fixtureTeams].sort((a, b) => a.name.localeCompare(b.name)),
  );

  if (teamsList.length === 0) {
    return {
      competition: {
        id: competition.id,
        slug: competition.slug,
        name: competition.name,
      },
      teams: [],
      players: [],
    };
  }

  const teamIds = teamsList.map((t) => t.id);
  const teamNameById = new Map(teamsList.map((t) => [t.id, t.name]));
  const db = getDb();

  const clubPlayers = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      position: players.positionName,
      teamId: players.clubTeamId,
    })
    .from(players)
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        inArray(players.clubTeamId, teamIds),
      ),
    )
    .orderBy(asc(players.name));

  // Also include players who appeared for these teams in this competition
  // (covers squad members without clubTeamId set).
  const appearancePlayers = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      position: players.positionName,
      teamId: fixturePlayers.teamId,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(
      and(
        eq(fixtures.competitionId, competition.id),
        inArray(fixturePlayers.teamId, teamIds),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        sql`${players.slug} is not null`,
      ),
    );

  const byId = new Map<string, CompareRosterPlayer>();
  for (const row of clubPlayers) {
    if (!row.teamId || !row.slug?.trim()) continue;
    byId.set(row.id, {
      id: row.id,
      slug: row.slug.trim(),
      name: row.name,
      position: row.position,
      teamId: row.teamId,
      teamName: teamNameById.get(row.teamId) ?? "Unknown club",
    });
  }
  for (const row of appearancePlayers) {
    if (!row.teamId || !row.slug?.trim()) continue;
    if (byId.has(row.id)) continue;
    byId.set(row.id, {
      id: row.id,
      slug: row.slug.trim(),
      name: row.name,
      position: row.position,
      teamId: row.teamId,
      teamName: teamNameById.get(row.teamId) ?? "Unknown club",
    });
  }

  const rosterPlayers = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    competition: {
      id: competition.id,
      slug: competition.slug,
      name: competition.name,
    },
    teams: teamsList,
    players: rosterPlayers,
  };
}
