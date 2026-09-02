/**
 * Competition → team → player roster for the public compare picker.
 * Uses standings/fixtures for teams and published club squads for players
 * (not leaderboard stats, which are often empty).
 */
import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, players, teams } from "@rugby365/db";
import {
  cleanComparePickerPlayerName,
  resolveComparePickerClubName,
  resolveComparePickerCountryName,
} from "./compare-player-picker-groups";
import { isRealCompareRosterTeamName } from "./compare-roster-team-name";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  getCompetitionStandingsBySlug,
} from "./competition-admin-service";
import { fixtureBelongsToSeason, seasonKindFromCompetitionType } from "./fixture-season-resolve";
import { teamDedupKey } from "./entity-normalize";
import { canonicalStandingsTeamName } from "./table-lab/standings-fixture-dedupe";
import {
  isRugbyWorldCupParticipantName,
  isRugbyWorldCupSlug,
  resolveRugbyWorldCupYear,
} from "./rugby-world-cup-pools";

export type CompareRosterTeam = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  countryName: string | null;
  teamType: string | null;
};

export type CompareRosterPlayer = {
  id: string;
  slug: string;
  name: string;
  position: string | null;
  teamId: string;
  teamName: string;
  clubName: string | null;
  countryName: string | null;
};

export type CompetitionCompareRoster = {
  competition: { id: string; slug: string; name: string };
  teams: CompareRosterTeam[];
  players: CompareRosterPlayer[];
};

export { isRealCompareRosterTeamName } from "./compare-roster-team-name";

function dedupeTeamsByCanonicalIdentity(list: CompareRosterTeam[]): CompareRosterTeam[] {
  const groups = new Map<string, CompareRosterTeam[]>();
  for (const team of list) {
    const key = teamDedupKey(canonicalStandingsTeamName(team.name));
    const bucket = groups.get(key) ?? [];
    bucket.push(team);
    groups.set(key, bucket);
  }
  return [...groups.values()]
    .map((candidates) => {
      const sorted = [...candidates].sort((a, b) => {
        const aLegacy = a.slug.includes("__legacy__") ? 1 : 0;
        const bLegacy = b.slug.includes("__legacy__") ? 1 : 0;
        if (aLegacy !== bLegacy) return aLegacy - bLegacy;
        const aOrphan = a.slug.startsWith("orphan-") ? 1 : 0;
        const bOrphan = b.slug.startsWith("orphan-") ? 1 : 0;
        if (aOrphan !== bOrphan) return aOrphan - bOrphan;
        if (a.slug.length !== b.slug.length) return a.slug.length - b.slug.length;
        return a.slug.localeCompare(b.slug);
      });
      const winner = sorted[0]!;
      return {
        ...winner,
        name: canonicalStandingsTeamName(winner.name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listTeamsFromFixtures(
  competitionId: string,
  season?: { id: string; year: number } | null,
  competitionType?: string | null,
): Promise<CompareRosterTeam[]> {
  const db = getDb();
  const rows = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      externalMatchId: fixtures.externalMatchId,
      stage: fixtures.stage,
      round: fixtures.round,
      seasonId: fixtures.seasonId,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixtures)
    .where(eq(fixtures.competitionId, competitionId));

  const seasonKind = seasonKindFromCompetitionType(competitionType);
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
    if (season) {
      if (
        !fixtureBelongsToSeason({
          fixtureSeasonId: row.seasonId,
          kickoffAt: row.kickoffAt,
          seasonId: season.id,
          seasonYear: season.year,
          seasonKind,
        })
      ) {
        continue;
      }
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
      countryName: teams.countryName,
      teamType: teams.teamType,
    })
    .from(teams)
    .where(inArray(teams.id, [...ids]))
    .orderBy(asc(teams.name));

  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    shortName: t.shortName ?? null,
    countryName: t.countryName ?? null,
    teamType: t.teamType ?? null,
  }));
}

export async function getCompetitionCompareRosterBySlug(
  slug: string,
  options: { seasonLabel?: string } = {},
): Promise<CompetitionCompareRoster | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  const standingsData = await getCompetitionStandingsBySlug(competition.slug, {
    seasonLabel: options.seasonLabel,
  });
  const season = standingsData?.season ?? null;
  const rwcYear = isRugbyWorldCupSlug(competition.slug)
    ? resolveRugbyWorldCupYear({
        seasonYear: options.seasonLabel ? season?.year : null,
        seasonLabel: options.seasonLabel ?? null,
      })
    : null;

  const standingTeams: CompareRosterTeam[] = (standingsData?.standings ?? [])
    .filter((row) => Boolean(row.teamId && row.teamName))
    .filter((row) => isRealCompareRosterTeamName(row.teamName!))
    .map((row) => ({
      id: row.teamId!,
      name: row.teamName!,
      slug: row.teamSlug ?? row.teamId!,
      shortName: row.teamShortName ?? null,
      countryName: null,
      teamType: null,
    }));

  const fixtureTeams = (
    await listTeamsFromFixtures(
      competition.id,
      options.seasonLabel && season ? { id: season.id, year: season.year } : null,
      competition.competitionType,
    )
  ).filter((t) => isRealCompareRosterTeamName(t.name));

  let teamsList = dedupeTeamsByCanonicalIdentity(
    [...standingTeams, ...fixtureTeams].sort((a, b) => a.name.localeCompare(b.name)),
  );

  if (isRugbyWorldCupSlug(competition.slug)) {
    teamsList = teamsList.filter((team) => isRugbyWorldCupParticipantName(team.name, rwcYear));
  }

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
  const db = getDb();
  const isRwc = isRugbyWorldCupSlug(competition.slug);

  const allTeamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      countryName: teams.countryName,
      teamType: teams.teamType,
    })
    .from(teams);
  const teamMetaById = new Map(allTeamRows.map((row) => [row.id, row] as const));
  teamsList = teamsList.map((team) => {
    const meta = teamMetaById.get(team.id);
    return {
      ...team,
      countryName: team.countryName ?? meta?.countryName ?? null,
      teamType: team.teamType ?? meta?.teamType ?? null,
    };
  });
  const teamNameById = new Map(teamsList.map((t) => [t.id, t.name]));
  const teamMetaForRoster = new Map(teamsList.map((t) => [t.id, t] as const));

  const rosterKeyToId = new Map(
    teamsList.map((team) => [teamDedupKey(canonicalStandingsTeamName(team.name)), team.id] as const),
  );
  const rawIdToRosterId = new Map<string, string>();
  const expandedIds: string[] = [];
  for (const row of allTeamRows) {
    const rosterId = rosterKeyToId.get(teamDedupKey(canonicalStandingsTeamName(row.name)));
    if (!rosterId) continue;
    expandedIds.push(row.id);
    rawIdToRosterId.set(row.id, rosterId);
  }
  for (const id of teamIds) {
    if (!rawIdToRosterId.has(id)) rawIdToRosterId.set(id, id);
    if (!expandedIds.includes(id)) expandedIds.push(id);
  }

  const playerFields = {
    id: players.id,
    slug: players.slug,
    name: players.name,
    position: players.positionName,
    clubName: players.clubName,
    countryName: players.countryName,
    nationCode: players.nationCode,
    clubTeamId: players.clubTeamId,
    internationalTeamId: players.internationalTeamId,
  };

  const linkedPlayers =
    expandedIds.length === 0
      ? []
      : await db
          .select(playerFields)
          .from(players)
          .where(
            and(
              eq(players.isPublic, true),
              eq(players.publishStatus, "published"),
              or(
                inArray(players.clubTeamId, expandedIds),
                inArray(players.internationalTeamId, expandedIds),
              ),
            ),
          )
          .orderBy(asc(players.name));

  // Also include players who appeared for these teams in this competition
  // (covers squad members without clubTeamId set).
  const appearancePlayers = await db
    .select({
      ...playerFields,
      teamId: fixturePlayers.teamId,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(
      and(
        eq(fixtures.competitionId, competition.id),
        inArray(fixturePlayers.teamId, expandedIds.length ? expandedIds : teamIds),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        sql`${players.slug} is not null`,
      ),
    );

  const resolveRosterTeam = (rawTeamId: string | null | undefined): string | null => {
    if (!rawTeamId) return null;
    return rawIdToRosterId.get(rawTeamId) ?? (teamNameById.has(rawTeamId) ? rawTeamId : null);
  };

  const toRosterPlayer = (
    row: {
      id: string;
      slug: string | null;
      name: string;
      position: string | null;
      clubName: string | null;
      countryName: string | null;
      nationCode: string | null;
      clubTeamId: string | null;
      internationalTeamId: string | null;
    },
    rosterId: string | null,
  ): CompareRosterPlayer | null => {
    if (!row.slug?.trim()) return null;
    if (!row.name?.trim() || /^[-–—._]+$/.test(row.name.trim())) return null;
    const clubMeta = row.clubTeamId ? teamMetaById.get(row.clubTeamId) : null;
    const intlMeta = row.internationalTeamId ? teamMetaById.get(row.internationalTeamId) : null;
    const rosterMeta = rosterId ? teamMetaForRoster.get(rosterId) : null;
    const clubName = resolveComparePickerClubName({
      clubName: row.clubName,
      clubTeamName: clubMeta?.name ?? null,
      clubTeamType: clubMeta?.teamType ?? null,
    });
    const countryName = resolveComparePickerCountryName({
      countryName: row.countryName,
      nationCode: row.nationCode,
      internationalTeamName: intlMeta?.name ?? null,
      internationalTeamType: intlMeta?.teamType ?? null,
      rosterTeamName: rosterMeta?.name ?? null,
      rosterTeamType: rosterMeta?.teamType ?? null,
      clubCountryName: clubMeta?.countryName ?? null,
      clubName,
    });
    return {
      id: row.id,
      slug: row.slug.trim(),
      name: cleanComparePickerPlayerName(row.name) || row.name,
      position: row.position,
      teamId: rosterId ?? "",
      teamName: (rosterId && teamNameById.get(rosterId)) || "Unassigned",
      clubName,
      countryName,
    };
  };

  const byId = new Map<string, CompareRosterPlayer>();
  for (const row of linkedPlayers) {
    const rosterId = isRwc
      ? resolveRosterTeam(row.internationalTeamId) ?? resolveRosterTeam(row.clubTeamId)
      : resolveRosterTeam(row.clubTeamId) ?? resolveRosterTeam(row.internationalTeamId);
    const mapped = toRosterPlayer(row, rosterId);
    if (!mapped) continue;
    byId.set(row.id, mapped);
  }
  for (const row of appearancePlayers) {
    if (byId.has(row.id)) continue;
    const rosterId = resolveRosterTeam(row.teamId);
    const mapped = toRosterPlayer(row, rosterId);
    if (!mapped) continue;
    byId.set(row.id, mapped);
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
