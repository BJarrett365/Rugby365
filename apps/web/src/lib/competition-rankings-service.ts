import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  coachMatchRatings,
  coaches,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerCareerStints,
  playerMatchRatings,
  playerRatings,
  players,
  refereeMatchRatings,
  referees,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  listSeasonsForPicker,
  syncDomesticSeasonCatalog,
} from "./competition-admin-service";
import {
  RANKING_POSITION_LABELS,
  average,
  isProvisional,
  isRankingRetired,
  isUnknownRankingOfficial,
  pickDefaultRankingSeason,
  previousRankByPriorAverage,
  rankingPositionGroup,
  rankingTrend,
  rating10To100,
  refereeDifficultyAdjustment,
  refereeNationalityFallback,
  refereeClubFallback,
  mergeRefereeClubs,
  collectRefereeAppointmentClubs,
  foldRefereeIdentity,
  computeRefereeFormScore,
  padRefereeFormSeries,
  tournamentRatingFromMatches,
  type RankingPositionGroup,
  type RankingTrend,
} from "./competition-ranking-math";
import { parseSeasonStartYear, usesDomesticSeasonCatalog } from "./season-label-utils";
import {
  isInternationalLeaderboardTeam,
  nationalTeamNickname,
  teamCodeForLeaderboard,
} from "./competition-player-stat-display";
import {
  canonicalStandingsTeamName,
  isUnknownStandingsTeamName,
  pickCanonicalFixturesForStandings,
  pickCanonicalTeamIdByName,
  resolveTeamNamesFromFixtureSlug,
} from "./table-lab/standings-fixture-dedupe";
import {
  cleanRankingClubName,
  cleanRankingPlayerName,
  fillDisplayMovement,
  isDirtyRankingPlayerName,
  isGarbageRankingClubTeam,
  pickCareerClubName,
  pickRankingClubCrest,
  rankingCountryFlagUrl,
  usableRankingCountryName,
} from "./player-ranking-engine";

const clubTeams = alias(teams, "ranking_club_teams");
const ratingHomeTeams = alias(teams, "ranking_home_teams");
const ratingAwayTeams = alias(teams, "ranking_away_teams");

function rankingPersonCountry(
  teamName: string | null | undefined,
  nationality: string | null | undefined,
  countryOfBirth: string | null | undefined,
): string | null {
  for (const candidate of [nationality, countryOfBirth, teamName]) {
    const label = rankingNationLabel(null, candidate, null);
    if (label && rankingCountryFlagUrl(label)) return label;
  }
  return rankingNationLabel(teamName, null, null);
}

function clubsFromRefereeSocial(raw: unknown): { lastClub: string | null; clubs: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const ranking = (raw as { rankingClubs?: { lastClub?: string; clubs?: string[] } }).rankingClubs;
  if (!ranking) return null;
  const clubs = (ranking.clubs ?? []).map((c) => c.trim()).filter(Boolean);
  return { lastClub: ranking.lastClub?.trim() || clubs.at(-1) || null, clubs };
}

function rankingNationLabel(
  teamName: string | null | undefined,
  playerCountryName: string | null | undefined,
  resolvedFromSlug: string | null | undefined,
): string | null {
  for (const candidate of [resolvedFromSlug, teamName, playerCountryName]) {
    const usable = usableRankingCountryName(candidate);
    if (!usable || isUnknownStandingsTeamName(usable)) continue;
    return canonicalStandingsTeamName(usable);
  }
  return null;
}

function ratingOnHundred(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const scaled = value > 10 ? value : value * 10;
  return Math.round(Math.min(99, Math.max(0, scaled)));
}

function rejectNationAsClub(name: string | null | undefined): string | null {
  const cleaned = cleanRankingClubName(name);
  if (!cleaned) return null;
  if (isInternationalLeaderboardTeam(cleaned)) return null;
  if (/\s+(a|xv)$/i.test(cleaned) || /\bxv\b/i.test(cleaned)) return null;
  return cleaned;
}

function isUsableRefereeAppointmentTeam(input: {
  name: string;
  slug: string | null;
  teamType: string | null;
}): { name: string; slug: string | null } | null {
  const teamType = (input.teamType ?? "").toLowerCase();
  if (teamType === "nation" || teamType === "national" || teamType === "international") return null;
  if (isUnknownStandingsTeamName(input.name)) return null;
  const name = rejectNationAsClub(input.name);
  if (!name) return null;
  if (/\d{4}\s+\d{2}\s+\d{2}/.test(name)) return null;
  const slug =
    input.slug && !isGarbageRankingClubTeam(name, input.slug) ? input.slug : null;
  return { name, slug };
}

async function loadRefereeCareerAppointmentClubs(
  board: Array<{ refereeId: string; refereeName: string }>,
): Promise<
  Map<
    string,
    {
      lastClub: string | null;
      clubs: string[];
      crests: Map<string, { slug: string; imageUrl: string | null }>;
    }
  >
> {
  const map = new Map<
    string,
    {
      lastClub: string | null;
      clubs: string[];
      crests: Map<string, { slug: string; imageUrl: string | null }>;
    }
  >();
  if (!board.length) return map;
  const db = getDb();
  const allRefs = await db.select({ id: referees.id, name: referees.name }).from(referees);
  const boardIdByKey = new Map<string, string>();
  const aliasToBoard = new Map<string, string>();
  for (const row of board) {
    boardIdByKey.set(foldRefereeIdentity(row.refereeName), row.refereeId);
    aliasToBoard.set(row.refereeId, row.refereeId);
  }
  for (const row of allRefs) {
    const boardId = boardIdByKey.get(foldRefereeIdentity(row.name));
    if (!boardId) continue;
    aliasToBoard.set(row.id, boardId);
  }
  const uniqueIds = [...new Set(aliasToBoard.keys())];
  if (!uniqueIds.length) return map;
  const rows = await db
    .select({
      refereeId: fixtures.refereeId,
      teamName: teams.name,
      teamSlug: teams.slug,
      imageUrl: teams.imageUrl,
      teamType: teams.teamType,
      lastSeen: sql<Date | string | null>`max(${fixtures.kickoffAt})`,
    })
    .from(fixtures)
    .innerJoin(teams, sql`${teams.id} in (${fixtures.homeTeamId}, ${fixtures.awayTeamId})`)
    .where(inArray(fixtures.refereeId, uniqueIds))
    .groupBy(fixtures.refereeId, teams.id, teams.name, teams.slug, teams.imageUrl, teams.teamType);

  const byReferee = new Map<
    string,
    Array<{ name: string; slug: string | null; imageUrl: string | null; lastSeen: Date | string | null }>
  >();
  for (const row of rows) {
    if (!row.refereeId) continue;
    const boardId = aliasToBoard.get(row.refereeId);
    if (!boardId) continue;
    const usable = isUsableRefereeAppointmentTeam({
      name: row.teamName,
      slug: row.teamSlug,
      teamType: row.teamType,
    });
    if (!usable) continue;
    const list = byReferee.get(boardId) ?? [];
    list.push({
      name: usable.name,
      slug: usable.slug,
      imageUrl: row.imageUrl,
      lastSeen: row.lastSeen,
    });
    byReferee.set(boardId, list);
  }

  for (const [refereeId, clubs] of byReferee) {
    const collected = collectRefereeAppointmentClubs(clubs);
    const crests = new Map<string, { slug: string; imageUrl: string | null }>();
    for (const hit of collected.hits) {
      if (!hit.slug) continue;
      crests.set(hit.name.toLowerCase(), { slug: hit.slug, imageUrl: hit.imageUrl });
    }
    map.set(refereeId, {
      lastClub: collected.lastClub,
      clubs: collected.clubs,
      crests,
    });
  }
  return map;
}

async function loadCareerClubNames(
  playerIds: string[],
  year?: number | null,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!playerIds.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerCareerStints.playerId,
      teamName: playerCareerStints.teamName,
      careerType: playerCareerStints.careerType,
      startYear: playerCareerStints.startYear,
      endYear: playerCareerStints.endYear,
      sortOrder: playerCareerStints.sortOrder,
    })
    .from(playerCareerStints)
    .where(inArray(playerCareerStints.playerId, playerIds));
  const byPlayer = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }
  for (const [playerId, stints] of byPlayer) {
    const club = rejectNationAsClub(pickCareerClubName(stints, year));
    if (club) map.set(playerId, club);
  }
  return map;
}

async function loadTournamentClubNames(
  competitionId: string,
  seasonId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const db = getDb();
  const rows = await db
    .select({
      playerId: fixturePlayers.playerId,
      clubName: fixturePlayers.clubName,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(
      and(
        eq(fixtures.competitionId, competitionId),
        eq(fixtures.seasonId, seasonId),
        isNotNull(fixturePlayers.clubName),
      ),
    );
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const club = rejectNationAsClub(row.clubName);
    if (!club) continue;
    const byClub = counts.get(row.playerId) ?? new Map<string, number>();
    byClub.set(club, (byClub.get(club) ?? 0) + 1);
    counts.set(row.playerId, byClub);
  }
  for (const [playerId, byClub] of counts) {
    const best = [...byClub.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) map.set(playerId, best[0]);
  }
  return map;
}

async function loadClubCrestsByName(
  names: string[],
): Promise<Map<string, { slug: string; imageUrl: string | null }>> {
  const map = new Map<string, { slug: string; imageUrl: string | null }>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      name: teams.name,
      slug: teams.slug,
      imageUrl: teams.imageUrl,
    })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const catalog = rows.filter((row) => !isInternationalLeaderboardTeam(row.name));
  for (const requested of unique) {
    const hit = pickRankingClubCrest(requested, catalog);
    if (!hit) continue;
    map.set(requested.toLowerCase(), hit);
  }
  return map;
}

async function loadClubYearRatings(
  playerIds: string[],
  competitionId: string,
  year: number,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!playerIds.length || !Number.isFinite(year)) return map;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      rating: playerMatchRatings.rating,
      manualOverrideRating: playerMatchRatings.manualOverrideRating,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        inArray(playerMatchRatings.playerId, playerIds),
        ne(playerMatchRatings.competitionId, competitionId),
        isNotNull(playerMatchRatings.rating),
        gte(fixtures.kickoffAt, new Date(Date.UTC(year, 0, 1))),
        lt(fixtures.kickoffAt, new Date(Date.UTC(year + 1, 0, 1))),
      ),
    );
  const byPlayer = new Map<string, number[]>();
  for (const row of rows) {
    const r10 =
      row.manualOverrideRating != null && Number.isFinite(row.manualOverrideRating)
        ? row.manualOverrideRating
        : row.rating;
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(r100);
    byPlayer.set(row.playerId, list);
  }
  for (const [playerId, ratings] of byPlayer) {
    const avg = average(ratings);
    if (avg != null) map.set(playerId, avg);
  }
  return map;
}

export type CompetitionRankingsTab = "players" | "teams" | "referees" | "coaches";

export type CompetitionPlayerRankingRow = {
  rank: number;
  provisional: boolean;
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamCode: string | null;
  teamRank: number | null;
  clubName: string | null;
  clubSlug: string | null;
  clubImageUrl: string | null;
  nationName: string | null;
  nationSlug: string | null;
  nationImageUrl: string | null;
  positionGroup: RankingPositionGroup;
  positionLabel: string;
  matches: number;
  avgRating: number;
  bestRating: number;
  internationalPerformance: number | null;
  clubPerformance: number | null;
  positionPerformance: number | null;
  previousRank: number | null;
  trend: RankingTrend;
  recentRatings: number[];
  retired: boolean;
};

export type CompetitionPlayerPositionBoard = {
  positionGroup: RankingPositionGroup;
  label: string;
  entries: CompetitionPlayerRankingRow[];
};

export type CompetitionTeamRankingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamCode: string;
  teamNickname: string | null;
  teamImageUrl: string | null;
  countryName: string | null;
  nationImageUrl: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsDiff: number;
  points: number;
  form: string | null;
};

export type CompetitionRefereeRankingRow = {
  rank: number;
  provisional: boolean;
  refereeId: string;
  refereeName: string;
  refereeSlug: string;
  refereeImageUrl: string | null;
  nationName: string | null;
  nationSlug: string | null;
  nationImageUrl: string | null;
  clubName: string | null;
  clubSlug: string | null;
  clubImageUrl: string | null;
  otherClubs: Array<{ name: string; slug: string | null; imageUrl: string | null }>;
  matches: number;
  avgRating: number;
  tournamentRating: number;
  bestRating: number;
  tournamentPerformance: number | null;
  matchPerformance: number | null;
  peakPerformance: number | null;
  previousRank: number | null;
  trend: RankingTrend;
  recentRatings: number[];
  cardsIssued: number | null;
  retired: boolean;
};

export type CompetitionCoachRankingRow = {
  rank: number;
  provisional: boolean;
  coachId: string;
  coachName: string;
  coachSlug: string;
  coachImageUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamCode: string | null;
  teamImageUrl: string | null;
  nationName: string | null;
  nationSlug: string | null;
  nationImageUrl: string | null;
  matches: number;
  wins: number;
  winRate: number;
  avgRating: number;
  tournamentRating: number;
  bestRating: number;
  tournamentPerformance: number | null;
  teamPerformance: number | null;
  matchPerformance: number | null;
  previousRank: number | null;
  trend: RankingTrend;
  recentRatings: number[];
  retired: boolean;
};

export type CompetitionRankingsPayload = {
  competition: { id: string; slug: string; name: string };
  seasons: Array<{
    id: string;
    label: string;
    year: number;
    isActive: boolean;
    displayLabel?: string;
  }>;
  season: { id: string; label: string; year: number; isActive: boolean } | null;
  notes: {
    players: string;
    referees: string;
    coaches: string;
  };
  playersByPosition: CompetitionPlayerPositionBoard[];
  playersOverall: CompetitionPlayerRankingRow[];
  teams: CompetitionTeamRankingRow[];
  referees: CompetitionRefereeRankingRow[];
  coaches: CompetitionCoachRankingRow[];
  coverage: {
    playerRatedMatches: number;
    refereeRatedMatches: number;
    coachRatedMatches: number;
  };
};

async function seasonIdsWithFinishedFixtures(competitionId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ seasonId: fixtures.seasonId, n: count() })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, competitionId),
        inArray(fixtures.status, ["full_time", "finished", "result"]),
        isNotNull(fixtures.seasonId),
      ),
    )
    .groupBy(fixtures.seasonId);
  return new Set(rows.map((row) => row.seasonId).filter((id): id is string => Boolean(id)));
}

async function resolveSeasonForCompetition(competitionId: string, seasonLabel?: string) {
  const seasons = await listSeasonsForPicker(competitionId);
  const active = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
  if (seasonLabel?.trim()) {
    const requested = seasonLabel.trim();
    const requestedYear = parseSeasonStartYear(requested);
    const match =
      seasons.find((s) => s.label === requested) ??
      seasons.find((s) => s.label.replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
      (requestedYear != null ? seasons.find((s) => s.year === requestedYear) : null) ??
      null;
    return { seasons, season: match };
  }
  const withResults = await seasonIdsWithFinishedFixtures(competitionId);
  return { seasons, season: pickDefaultRankingSeason(seasons, withResults) ?? active };
}

function effectiveStaffRating(row: {
  rating: number | null;
  manualOverrideRating: number | null;
  ratingStatus: string;
}): number | null {
  if (row.manualOverrideRating != null && Number.isFinite(row.manualOverrideRating)) {
    return row.manualOverrideRating;
  }
  const status = row.ratingStatus.toLowerCase();
  if (
    status !== "available" &&
    status !== "override" &&
    status !== "final" &&
    status !== "published"
  ) {
    return null;
  }
  if (row.rating == null || !Number.isFinite(row.rating)) return null;
  return row.rating;
}

export async function getCompetitionRankingsBySlug(
  slug: string,
  options: { seasonLabel?: string; limit?: number } = {},
): Promise<CompetitionRankingsPayload | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  if (usesDomesticSeasonCatalog(competition.competitionType)) {
    await syncDomesticSeasonCatalog(competition.id);
  }

  const { seasons, season } = await resolveSeasonForCompetition(
    competition.id,
    options.seasonLabel,
  );
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const notes = {
    players:
      "Ranked by average Rugby365 match rating in this competition season. Club is the player’s club side; country is the national team. Club performance uses club ratings from the same calendar year when available.",
    referees:
      "Current form (last 5) is weighted: match performance 35%, decision accuracy 25%, penalty consistency 15%, card management 10%, game control 10%, recent appointments 5%. Tournament rating also includes knockout difficulty. Provisional until 2 matches.",
    coaches:
      "Tournament rating = average match rating (/100). Wins and win-rate shown for context. Provisional until 2 matches. Full expectation-adjusted model expands as more squad-strength data is wired.",
  };

  const empty: CompetitionRankingsPayload = {
    competition: { id: competition.id, slug: competition.slug, name: competition.name },
    seasons,
    season: season
      ? { id: season.id, label: season.label, year: season.year, isActive: season.isActive }
      : null,
    notes,
    playersByPosition: [],
    playersOverall: [],
    teams: [],
    referees: [],
    coaches: [],
    coverage: { playerRatedMatches: 0, refereeRatedMatches: 0, coachRatedMatches: 0 },
  };

  if (!season) return empty;

  const db = getDb();

  // ── Teams (from finished fixtures) ───────────────────────────────────────
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
      round: fixtures.round,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, competition.id),
        eq(fixtures.seasonId, season.id),
        inArray(fixtures.status, ["full_time", "finished", "result"]),
      ),
    );

  const teamIds = [
    ...new Set(
      fixtureRows
        .flatMap((f) => [f.homeTeamId, f.awayTeamId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const teamMetaRows =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            shortName: teams.shortName,
            imageUrl: teams.imageUrl,
            countryName: teams.countryName,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds));
  const teamMeta = new Map(teamMetaRows.map((t) => [t.id, t]));
  const canonicalTeamByName = pickCanonicalTeamIdByName(teamMetaRows);
  const finishedFixtures = pickCanonicalFixturesForStandings(fixtureRows, (fx) => {
    const home = teamMeta.get(fx.homeTeamId ?? "")?.name ?? "";
    const away = teamMeta.get(fx.awayTeamId ?? "")?.name ?? "";
    const resolved = resolveTeamNamesFromFixtureSlug(fx.slug, home, away);
    return {
      id: fx.id,
      slug: fx.slug,
      status: fx.status,
      homeScore: fx.homeScore ?? 0,
      awayScore: fx.awayScore ?? 0,
      homeName: resolved.homeName,
      awayName: resolved.awayName,
      kickoffAt: fx.kickoffAt,
    };
  });

  type TeamAgg = {
    teamId: string;
    teamName: string;
    teamSlug: string;
    teamShortName: string | null;
    teamImageUrl: string | null;
    countryName: string | null;
    played: number;
    won: number;
    draw: number;
    lost: number;
    pf: number;
    pa: number;
  };
  const teamMap = new Map<string, TeamAgg>();
  function touchTeam(id: string | null) {
    if (!id) return null;
    const existing = teamMap.get(id);
    if (existing) return existing;
    const meta = teamMeta.get(id);
    if (!meta) return null;
    const row: TeamAgg = {
      teamId: id,
      teamName: meta.name,
      teamSlug: meta.slug,
      teamShortName: meta.shortName,
      teamImageUrl: meta.imageUrl,
      countryName: meta.countryName,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pf: 0,
      pa: 0,
    };
    teamMap.set(id, row);
    return row;
  }

  for (const fx of finishedFixtures) {
    const home = touchTeam(fx.homeTeamId);
    const away = touchTeam(fx.awayTeamId);
    if (!home || !away) continue;
    const hs = fx.homeScore ?? 0;
    const as = fx.awayScore ?? 0;
    home.played += 1;
    away.played += 1;
    home.pf += hs;
    home.pa += as;
    away.pf += as;
    away.pa += hs;
    if (hs > as) {
      home.won += 1;
      away.lost += 1;
    } else if (as > hs) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
    }
  }

  const teamsRanked = [...teamMap.values()]
    .reduce<TeamAgg[]>((acc, t) => {
      const name = canonicalStandingsTeamName(t.teamName);
      if (isUnknownStandingsTeamName(name)) return acc;
      const canonical = canonicalTeamByName.get(name.toLowerCase());
      const existing = acc.find((row) => canonicalStandingsTeamName(row.teamName).toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.played += t.played;
        existing.won += t.won;
        existing.draw += t.draw;
        existing.lost += t.lost;
        existing.pf += t.pf;
        existing.pa += t.pa;
        return acc;
      }
      const canonMeta = canonical ? teamMeta.get(canonical.id) : undefined;
      acc.push({
        ...t,
        teamId: canonical?.id ?? t.teamId,
        teamName: canonical?.name ?? name,
        teamSlug: canonMeta?.slug ?? t.teamSlug,
        teamShortName: canonMeta?.shortName ?? t.teamShortName,
        teamImageUrl: canonMeta?.imageUrl ?? t.teamImageUrl,
        countryName: canonMeta?.countryName ?? t.countryName,
      });
      return acc;
    }, [])
    .map((t) => ({
      ...t,
      points: t.won * 4 + t.draw * 2,
      pointsDiff: t.pf - t.pa,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return a.teamName.localeCompare(b.teamName);
    });

  const teamRankById = new Map<string, number>();
  const teamRows: CompetitionTeamRankingRow[] = teamsRanked.map((t, i) => {
    teamRankById.set(t.teamId, i + 1);
    return {
      rank: i + 1,
      teamId: t.teamId,
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      teamCode: teamCodeForLeaderboard({
        teamName: t.teamName,
        teamShortName: t.teamShortName,
      }),
      teamNickname: nationalTeamNickname(t.teamName, t.teamShortName),
      teamImageUrl: t.teamImageUrl,
      countryName:
        usableRankingCountryName(t.countryName) ??
        (isInternationalLeaderboardTeam(t.teamName) ? t.teamName : null),
      nationImageUrl: rankingCountryFlagUrl(
        usableRankingCountryName(t.countryName) ?? t.teamName,
      ),
      played: t.played,
      won: t.won,
      draw: t.draw,
      lost: t.lost,
      pointsDiff: t.pointsDiff,
      points: t.points,
      form: null,
    };
  });

  // ── Players by position ──────────────────────────────────────────────────
  const playerRows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      playerName: players.name,
      playerSlug: players.slug,
      playerImageUrl: players.imageUrl,
      teamId: playerMatchRatings.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      clubName: players.clubName,
      clubTeamName: clubTeams.name,
      clubTeamSlug: clubTeams.slug,
      clubTeamImageUrl: clubTeams.imageUrl,
      playerCountryName: players.countryName,
      nationCode: players.nationCode,
      careerStatus: players.careerStatus,
      seasonRating: playerRatings.seasonRating,
      overallRating: playerRatings.playerRating,
      positionName: playerMatchRatings.positionName,
      playerPositionName: players.positionName,
      rating: playerMatchRatings.rating,
      ratingStatus: playerMatchRatings.ratingStatus,
      manualOverrideRating: playerMatchRatings.manualOverrideRating,
      kickoffAt: fixtures.kickoffAt,
      fixtureSlug: fixtures.slug,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: ratingHomeTeams.name,
      awayTeamName: ratingAwayTeams.name,
    })
    .from(playerMatchRatings)
    .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
    .leftJoin(teams, eq(playerMatchRatings.teamId, teams.id))
    .leftJoin(clubTeams, eq(players.clubTeamId, clubTeams.id))
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .leftJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .leftJoin(ratingHomeTeams, eq(fixtures.homeTeamId, ratingHomeTeams.id))
    .leftJoin(ratingAwayTeams, eq(fixtures.awayTeamId, ratingAwayTeams.id))
    .where(
      and(
        eq(playerMatchRatings.competitionId, competition.id),
        eq(playerMatchRatings.seasonId, season.id),
        isNotNull(playerMatchRatings.rating),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  type PlayerAgg = {
    playerId: string;
    playerName: string;
    playerSlug: string;
    playerImageUrl: string | null;
    teamId: string | null;
    teamName: string | null;
    teamSlug: string | null;
    teamShortName: string | null;
    clubName: string | null;
    clubSlug: string | null;
    clubImageUrl: string | null;
    playerCountryName: string | null;
    nationCode: string | null;
    careerStatus: string | null;
    resolvedNation: string | null;
    seasonRating: number | null;
    overallRating: number | null;
    positionGroup: RankingPositionGroup;
    ratings: number[];
  };
  const playerMap = new Map<string, PlayerAgg>();
  for (const row of playerRows) {
    const r10 =
      row.manualOverrideRating != null && Number.isFinite(row.manualOverrideRating)
        ? row.manualOverrideRating
        : row.rating;
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    if (isDirtyRankingPlayerName(row.playerName)) continue;
    const pos = rankingPositionGroup(row.positionName ?? row.playerPositionName);
    const key = `${row.playerId}:${pos}`;
    const clubName = rejectNationAsClub(row.clubTeamName) ?? rejectNationAsClub(row.clubName);
    const resolved = resolveTeamNamesFromFixtureSlug(
      row.fixtureSlug,
      row.homeTeamName ?? "",
      row.awayTeamName ?? "",
    );
    const resolvedNation =
      row.teamId && row.teamId === row.homeTeamId
        ? resolved.homeName
        : row.teamId && row.teamId === row.awayTeamId
          ? resolved.awayName
          : resolved.homeName && !isUnknownStandingsTeamName(resolved.homeName)
            ? resolved.homeName
            : resolved.awayName;
    const existing = playerMap.get(key) ?? {
      playerId: row.playerId,
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      playerImageUrl: row.playerImageUrl,
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      teamShortName: row.teamShortName,
      clubName,
      clubSlug: clubName ? row.clubTeamSlug : null,
      clubImageUrl: clubName ? row.clubTeamImageUrl : null,
      playerCountryName: row.playerCountryName,
      nationCode: row.nationCode,
      careerStatus: row.careerStatus,
      resolvedNation,
      seasonRating: row.seasonRating,
      overallRating: row.overallRating,
      positionGroup: pos,
      ratings: [],
    };
    existing.ratings.push(r100);
    if (row.teamId) {
      existing.teamId = row.teamId;
      if (!isUnknownStandingsTeamName(row.teamName)) {
        existing.teamName = row.teamName;
        existing.teamSlug = row.teamSlug;
        existing.teamShortName = row.teamShortName;
      }
    }
    if (resolvedNation && !isUnknownStandingsTeamName(resolvedNation)) {
      existing.resolvedNation = resolvedNation;
    }
    if (row.playerCountryName && !isUnknownStandingsTeamName(row.playerCountryName)) {
      existing.playerCountryName = row.playerCountryName;
    }
    if (clubName) {
      existing.clubName = clubName;
      existing.clubSlug = row.clubTeamSlug ?? existing.clubSlug;
      existing.clubImageUrl = row.clubTeamImageUrl ?? existing.clubImageUrl;
    }
    if (row.seasonRating != null) existing.seasonRating = row.seasonRating;
    if (row.overallRating != null) existing.overallRating = row.overallRating;
    playerMap.set(key, existing);
  }

  const uniquePlayerIds = [...new Set([...playerMap.values()].map((p) => p.playerId))];
  const isWorldCup =
    competition.slug === "rugby-world-cup" || competition.competitionType === "world_cup";
  const [careerClubs, tournamentClubs, clubYearRatings] = await Promise.all([
    loadCareerClubNames(uniquePlayerIds, season.year),
    loadTournamentClubNames(competition.id, season.id),
    loadClubYearRatings(uniquePlayerIds, competition.id, season.year),
  ]);
  for (const p of playerMap.values()) {
    const tournament = tournamentClubs.get(p.playerId);
    const career = careerClubs.get(p.playerId);
    const next = isWorldCup
      ? (tournament ?? career ?? p.clubName)
      : (p.clubName ?? tournament ?? career);
    if (next && next !== p.clubName) {
      p.clubSlug = null;
      p.clubImageUrl = null;
    }
    p.clubName = next ?? null;
  }
  const crests = await loadClubCrestsByName(
    [...playerMap.values()].flatMap((p) => (p.clubName ? [p.clubName] : [])),
  );
  for (const p of playerMap.values()) {
    if (!p.clubName) continue;
    const crest = crests.get(p.clubName.toLowerCase());
    if (!crest) continue;
    p.clubSlug = p.clubSlug ?? crest.slug;
    p.clubImageUrl = p.clubImageUrl ?? crest.imageUrl;
  }

  const nationRows = await getDb()
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      imageUrl: teams.imageUrl,
      shortName: teams.shortName,
    })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const nationCatalog = pickCanonicalTeamIdByName(nationRows);
  const nationRowById = new Map(nationRows.map((row) => [row.id, row]));
  for (const p of playerMap.values()) {
    const nation = rankingNationLabel(p.teamName, p.playerCountryName, p.resolvedNation);
    p.teamName = nation;
    if (!nation) {
      p.teamSlug = null;
      continue;
    }
    const canonical = nationCatalog.get(nation.toLowerCase());
    if (!canonical) continue;
    const row = nationRowById.get(canonical.id);
    if (!row) continue;
    p.teamId = canonical.id;
    p.teamSlug = row.slug;
    p.teamShortName = row.shortName ?? p.teamShortName;
  }

  const sortPlayers = (a: PlayerAgg, b: PlayerAgg) => {
    const aProv = isProvisional(a.ratings.length);
    const bProv = isProvisional(b.ratings.length);
    if (aProv !== bProv) return aProv ? 1 : -1;
    const aAvg = average(a.ratings) ?? 0;
    const bAvg = average(b.ratings) ?? 0;
    if (bAvg !== aAvg) return bAvg - aAvg;
    if (b.ratings.length !== a.ratings.length) return b.ratings.length - a.ratings.length;
    return a.playerName.localeCompare(b.playerName);
  };

  const toPlayerRow = (
    p: PlayerAgg,
    rank: number,
    previousRank: number | null,
  ): CompetitionPlayerRankingRow => {
    const avg = average(p.ratings) ?? 0;
    const nationName =
      rankingNationLabel(p.teamName, p.playerCountryName, p.resolvedNation);
    const clubPerformance = ratingOnHundred(
      clubYearRatings.get(p.playerId) ?? p.seasonRating ?? p.overallRating ?? avg,
    );
    const internationalPerformance = ratingOnHundred(avg);
    const filled = fillDisplayMovement({
      rank,
      previousRank,
      ratingsNewestFirst: p.ratings,
      avgRating: avg,
      clubPerformance,
      internationalPerformance,
      bestRating: Math.max(...p.ratings),
    });
    return {
      rank,
      provisional: isProvisional(p.ratings.length),
      playerId: p.playerId,
      playerName: cleanRankingPlayerName(p.playerName) ?? p.playerName,
      playerSlug: p.playerSlug,
      playerImageUrl: p.playerImageUrl,
      teamId: p.teamId,
      teamName: nationName,
      teamSlug: p.teamSlug,
      teamCode: nationName
        ? teamCodeForLeaderboard({
            teamName: nationName,
            teamShortName: p.teamShortName,
          })
        : null,
      teamRank: p.teamId ? (teamRankById.get(p.teamId) ?? null) : null,
      clubName: p.clubName,
      clubSlug: p.clubSlug,
      clubImageUrl: p.clubImageUrl,
      nationName,
      nationSlug: p.teamSlug,
      nationImageUrl: rankingCountryFlagUrl(nationName, p.nationCode),
      positionGroup: p.positionGroup,
      positionLabel: RANKING_POSITION_LABELS[p.positionGroup],
      matches: p.ratings.length,
      avgRating: avg,
      bestRating: Math.max(...p.ratings),
      internationalPerformance,
      clubPerformance,
      positionPerformance: ratingOnHundred(avg),
      previousRank: filled.previousRank,
      trend: filled.movement,
      recentRatings: p.ratings.slice(0, 5),
      retired: isRankingRetired({
        careerStatus: p.careerStatus,
        name: p.playerName,
        seasonYear: season.year,
      }),
    };
  };

  const allPlayers = [...playerMap.values()].sort(sortPlayers);
  const bestByPlayer = new Map<string, PlayerAgg>();
  for (const p of allPlayers) {
    const existing = bestByPlayer.get(p.playerId);
    if (!existing) {
      bestByPlayer.set(p.playerId, p);
      continue;
    }
    const nextAvg = average(p.ratings) ?? 0;
    const prevAvg = average(existing.ratings) ?? 0;
    if (nextAvg > prevAvg) bestByPlayer.set(p.playerId, p);
  }
  const overallPool = [...bestByPlayer.values()].sort(sortPlayers);
  const overallPrev = previousRankByPriorAverage(overallPool);
  const playersOverall = overallPool
    .slice(0, limit)
    .map((p, i) => toPlayerRow(p, i + 1, overallPrev.get(p.playerId) ?? null));

  const positionOrder: RankingPositionGroup[] = [
    "props",
    "hookers",
    "locks",
    "back_row",
    "scrum_halves",
    "fly_halves",
    "centres",
    "wings",
    "full_backs",
  ];

  const playersByPosition: CompetitionPlayerPositionBoard[] = positionOrder
    .map((group) => {
      const pool = allPlayers.filter((p) => p.positionGroup === group);
      const prev = previousRankByPriorAverage(pool);
      return {
        positionGroup: group,
        label: RANKING_POSITION_LABELS[group],
        entries: pool
          .slice(0, limit)
          .map((p, i) => toPlayerRow(p, i + 1, prev.get(p.playerId) ?? null)),
      };
    })
    .filter((board) => board.entries.length > 0);

  // ── Referees ─────────────────────────────────────────────────────────────
  const refRows = await db
    .select({
      refereeId: refereeMatchRatings.refereeId,
      refereeName: referees.name,
      refereeSlug: referees.slug,
      refereeImageUrl: referees.imageUrl,
      countryName: referees.countryName,
      nationality: referees.nationality,
      socialAccounts: referees.socialAccounts,
      rating: refereeMatchRatings.rating,
      ratingStatus: refereeMatchRatings.ratingStatus,
      manualOverrideRating: refereeMatchRatings.manualOverrideRating,
      performanceTrend: refereeMatchRatings.performanceTrend,
      fixtureId: refereeMatchRatings.fixtureId,
      round: fixtures.round,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamName: ratingHomeTeams.name,
      awayTeamName: ratingAwayTeams.name,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(refereeMatchRatings)
    .innerJoin(referees, eq(refereeMatchRatings.refereeId, referees.id))
    .leftJoin(fixtures, eq(refereeMatchRatings.fixtureId, fixtures.id))
    .leftJoin(ratingHomeTeams, eq(fixtures.homeTeamId, ratingHomeTeams.id))
    .leftJoin(ratingAwayTeams, eq(fixtures.awayTeamId, ratingAwayTeams.id))
    .where(
      and(
        eq(refereeMatchRatings.competitionId, competition.id),
        eq(refereeMatchRatings.seasonId, season.id),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  const refereeFixtureIds = [
    ...new Set(refRows.map((row) => row.fixtureId).filter((id): id is string => Boolean(id))),
  ];
  const refereeEvents =
    refereeFixtureIds.length === 0
      ? []
      : await db
          .select({
            fixtureId: matchEvents.fixtureId,
            eventType: matchEvents.eventType,
          })
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, refereeFixtureIds));
  const eventsByFixture = new Map<string, Array<{ eventType: string }>>();
  for (const event of refereeEvents) {
    const list = eventsByFixture.get(event.fixtureId) ?? [];
    list.push({ eventType: event.eventType });
    eventsByFixture.set(event.fixtureId, list);
  }

  type RefAgg = {
    refereeId: string;
    refereeName: string;
    refereeSlug: string;
    refereeImageUrl: string | null;
    countryName: string | null;
    nationality: string | null;
    ratings100: number[];
    formScores: number[];
    bonuses: number[];
    cardsIssued: number;
    storedClubs: { lastClub: string | null; clubs: string[] } | null;
  };
  const refMap = new Map<string, RefAgg>();
  for (const row of refRows) {
    const r10 = effectiveStaffRating(row);
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    if (isUnknownRankingOfficial(row.refereeName)) continue;
    const margin =
      row.homeScore != null && row.awayScore != null
        ? Math.abs(row.homeScore - row.awayScore)
        : null;
    const bonus = refereeDifficultyAdjustment({
      rating100: r100,
      round: row.round,
      margin,
    });
    const events = row.fixtureId ? eventsByFixture.get(row.fixtureId) : undefined;
    const formScore = computeRefereeFormScore({
      rating100: r100,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      round: row.round,
      events,
    });
    const existing = refMap.get(row.refereeId) ?? {
      refereeId: row.refereeId,
      refereeName: row.refereeName,
      refereeSlug: row.refereeSlug,
      refereeImageUrl: row.refereeImageUrl,
      countryName: row.countryName,
      nationality: row.nationality,
      ratings100: [],
      formScores: [],
      bonuses: [],
      cardsIssued: 0,
      storedClubs: clubsFromRefereeSocial(row.socialAccounts),
    };
    existing.ratings100.push(r100);
    existing.formScores.push(formScore);
    existing.bonuses.push(bonus);
    if (events) {
      existing.cardsIssued += events.filter((event) => {
        const t = event.eventType.toLowerCase();
        return t.includes("yellow") || t.includes("red") || t.includes("sin");
      }).length;
    }
    refMap.set(row.refereeId, existing);
  }

  const refPool = [...refMap.values()];
  const refereeAppointmentClubs = await loadRefereeCareerAppointmentClubs(
    refPool.map((r) => ({ refereeId: r.refereeId, refereeName: r.refereeName })),
  );
  const refClubSets = new Map(
    refPool.map((r) => {
      const career = refereeAppointmentClubs.get(r.refereeId);
      return [
        r.refereeId,
        mergeRefereeClubs(
          career?.clubs.length ? null : refereeClubFallback(r.refereeName),
          career?.clubs.length ? null : r.storedClubs,
          career?.clubs.length ? { lastClub: career.lastClub, clubs: career.clubs } : null,
        ),
      ] as const;
    }),
  );
  const refCrests = await loadClubCrestsByName(
    [...refClubSets.values()].flatMap((set) => set.clubs),
  );
  for (const career of refereeAppointmentClubs.values()) {
    for (const [name, crest] of career.crests) {
      if (!refCrests.has(name)) refCrests.set(name, crest);
    }
  }
  const refPrev = previousRankByPriorAverage(
    refPool.map((r) => ({ playerId: r.refereeId, ratings: r.formScores })),
  );
  const refereeRankings: CompetitionRefereeRankingRow[] = refPool
    .map((r) => {
      const avg = average(r.ratings100) ?? 0;
      const formAvg = average(r.formScores) ?? avg;
      const tournament = tournamentRatingFromMatches(r.formScores, r.bonuses) ?? formAvg;
      const nationName = rankingNationLabel(
        null,
        refereeNationalityFallback(r.refereeName) ?? r.countryName ?? r.nationality,
        null,
      );
      const canonical = nationName ? nationCatalog.get(nationName.toLowerCase()) : null;
      const nationRow = canonical ? nationRowById.get(canonical.id) : null;
      const recentForm = padRefereeFormSeries(r.formScores.slice(0, 5));
      const clubSet = refClubSets.get(r.refereeId) ?? { lastClub: null, clubs: [] };
      const lastClub = clubSet.lastClub;
      const lastCrest = lastClub ? refCrests.get(lastClub.toLowerCase()) : null;
      const otherClubs = clubSet.clubs
        .filter((name) => name !== lastClub)
        .map((name) => {
          const crest = refCrests.get(name.toLowerCase());
          return { name, slug: crest?.slug ?? null, imageUrl: crest?.imageUrl ?? null };
        });
      return {
        provisional: isProvisional(r.ratings100.length),
        refereeId: r.refereeId,
        refereeName: r.refereeName,
        refereeSlug: r.refereeSlug,
        refereeImageUrl: r.refereeImageUrl,
        nationName,
        nationSlug: nationRow?.slug ?? null,
        nationImageUrl: rankingCountryFlagUrl(nationName),
        clubName: lastClub,
        clubSlug: lastCrest?.slug ?? null,
        clubImageUrl: lastCrest?.imageUrl ?? null,
        otherClubs,
        matches: r.ratings100.length,
        avgRating: formAvg,
        tournamentRating: tournament,
        bestRating: Math.max(...r.formScores, ...r.ratings100),
        tournamentPerformance: ratingOnHundred(tournament),
        matchPerformance: ratingOnHundred(avg),
        peakPerformance: ratingOnHundred(Math.max(...r.formScores, ...r.ratings100)),
        previousRank: refPrev.get(r.refereeId) ?? null,
        trend: rankingTrend(r.formScores.slice(0, 3), r.formScores.slice(3)),
        recentRatings: recentForm,
        cardsIssued: r.cardsIssued || null,
        retired: isRankingRetired({ name: r.refereeName, seasonYear: season.year }),
      };
    })
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.tournamentRating !== a.tournamentRating) return b.tournamentRating - a.tournamentRating;
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return a.refereeName.localeCompare(b.refereeName);
    })
    .map((row, i) => {
      const rank = i + 1;
      const filled = fillDisplayMovement({
        rank,
        previousRank: row.previousRank,
        ratingsNewestFirst: row.recentRatings,
        avgRating: row.avgRating,
        clubPerformance: row.matchPerformance,
        internationalPerformance: row.tournamentPerformance,
        bestRating: row.bestRating,
      });
      return { ...row, rank, previousRank: filled.previousRank, trend: filled.movement };
    });

  // ── Coaches ──────────────────────────────────────────────────────────────
  const coachRows = await db
    .select({
      coachId: coachMatchRatings.coachId,
      coachName: coaches.name,
      coachSlug: coaches.slug,
      coachImageUrl: coaches.imageUrl,
      nationality: coaches.nationality,
      countryOfBirth: coaches.countryOfBirth,
      teamId: coachMatchRatings.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      teamImageUrl: teams.imageUrl,
      side: coachMatchRatings.side,
      rating: coachMatchRatings.rating,
      ratingStatus: coachMatchRatings.ratingStatus,
      manualOverrideRating: coachMatchRatings.manualOverrideRating,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: ratingHomeTeams.name,
      awayTeamName: ratingAwayTeams.name,
      homeTeamSlug: ratingHomeTeams.slug,
      awayTeamSlug: ratingAwayTeams.slug,
      homeTeamShortName: ratingHomeTeams.shortName,
      awayTeamShortName: ratingAwayTeams.shortName,
      homeTeamImageUrl: ratingHomeTeams.imageUrl,
      awayTeamImageUrl: ratingAwayTeams.imageUrl,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(coachMatchRatings)
    .innerJoin(coaches, eq(coachMatchRatings.coachId, coaches.id))
    .leftJoin(teams, eq(coachMatchRatings.teamId, teams.id))
    .leftJoin(fixtures, eq(coachMatchRatings.fixtureId, fixtures.id))
    .leftJoin(ratingHomeTeams, eq(fixtures.homeTeamId, ratingHomeTeams.id))
    .leftJoin(ratingAwayTeams, eq(fixtures.awayTeamId, ratingAwayTeams.id))
    .where(
      and(
        eq(coachMatchRatings.competitionId, competition.id),
        eq(coachMatchRatings.seasonId, season.id),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  type CoachAgg = {
    coachId: string;
    coachName: string;
    coachSlug: string;
    coachImageUrl: string | null;
    nationality: string | null;
    countryOfBirth: string | null;
    teamId: string | null;
    teamName: string | null;
    teamSlug: string | null;
    teamShortName: string | null;
    teamImageUrl: string | null;
    ratings100: number[];
    wins: number;
    matches: number;
  };
  const coachMap = new Map<string, CoachAgg>();
  for (const row of coachRows) {
    const r10 = effectiveStaffRating(row);
    const r100 = rating10To100(r10);
    if (r100 == null) continue;
    const inferredTeam =
      row.teamId && row.teamName
        ? {
            teamId: row.teamId,
            teamName: row.teamName,
            teamSlug: row.teamSlug,
            teamShortName: row.teamShortName,
            teamImageUrl: row.teamImageUrl,
          }
        : row.side === "away"
          ? {
              teamId: row.awayTeamId,
              teamName: row.awayTeamName,
              teamSlug: row.awayTeamSlug,
              teamShortName: row.awayTeamShortName,
              teamImageUrl: row.awayTeamImageUrl,
            }
          : {
              teamId: row.homeTeamId,
              teamName: row.homeTeamName,
              teamSlug: row.homeTeamSlug,
              teamShortName: row.homeTeamShortName,
              teamImageUrl: row.homeTeamImageUrl,
            };
    const existing = coachMap.get(row.coachId) ?? {
      coachId: row.coachId,
      coachName: row.coachName,
      coachSlug: row.coachSlug,
      coachImageUrl: row.coachImageUrl,
      nationality: row.nationality,
      countryOfBirth: row.countryOfBirth,
      teamId: inferredTeam.teamId ?? null,
      teamName: inferredTeam.teamName ?? null,
      teamSlug: inferredTeam.teamSlug ?? null,
      teamShortName: inferredTeam.teamShortName ?? null,
      teamImageUrl: inferredTeam.teamImageUrl ?? null,
      ratings100: [],
      wins: 0,
      matches: 0,
    };
    existing.ratings100.push(r100);
    existing.matches += 1;
    if (row.homeScore != null && row.awayScore != null) {
      const forScore = row.side === "home" ? row.homeScore : row.awayScore;
      const against = row.side === "home" ? row.awayScore : row.homeScore;
      if (forScore > against) existing.wins += 1;
    }
    if (!existing.teamId && inferredTeam.teamId) {
      existing.teamId = inferredTeam.teamId;
      existing.teamName = inferredTeam.teamName ?? existing.teamName;
      existing.teamSlug = inferredTeam.teamSlug ?? existing.teamSlug;
      existing.teamShortName = inferredTeam.teamShortName ?? existing.teamShortName;
      existing.teamImageUrl = inferredTeam.teamImageUrl ?? existing.teamImageUrl;
    }
    coachMap.set(row.coachId, existing);
  }

  const coachPool = [...coachMap.values()];
  const coachPrev = previousRankByPriorAverage(
    coachPool.map((c) => ({ playerId: c.coachId, ratings: c.ratings100 })),
  );
  const coachRankings: CompetitionCoachRankingRow[] = coachPool
    .map((c) => {
      const avg = average(c.ratings100) ?? 0;
      const teamName = rankingNationLabel(c.teamName, null, null) ?? c.teamName;
      const nationName = rankingPersonCountry(teamName, c.nationality, c.countryOfBirth);
      const teamCanonical = teamName ? nationCatalog.get(teamName.toLowerCase()) : null;
      const nationCanonical = nationName ? nationCatalog.get(nationName.toLowerCase()) : null;
      const teamRow = teamCanonical ? nationRowById.get(teamCanonical.id) : null;
      const nationRow = nationCanonical ? nationRowById.get(nationCanonical.id) : null;
      return {
        provisional: isProvisional(c.ratings100.length),
        coachId: c.coachId,
        coachName: c.coachName,
        coachSlug: c.coachSlug,
        coachImageUrl: c.coachImageUrl,
        teamId: teamCanonical?.id ?? c.teamId,
        teamName,
        teamSlug: teamRow?.slug ?? c.teamSlug,
        teamCode: teamName
          ? teamCodeForLeaderboard({
              teamName,
              teamShortName: c.teamShortName,
            })
          : null,
        teamImageUrl: teamRow?.imageUrl ?? c.teamImageUrl,
        nationName,
        nationSlug: nationRow?.slug ?? teamRow?.slug ?? null,
        nationImageUrl: rankingCountryFlagUrl(nationName),
        matches: c.matches,
        wins: c.wins,
        winRate: c.matches ? Math.round((c.wins / c.matches) * 1000) / 10 : 0,
        avgRating: avg,
        tournamentRating: avg,
        bestRating: Math.max(...c.ratings100),
        tournamentPerformance: ratingOnHundred(avg),
        teamPerformance: ratingOnHundred(c.matches ? (c.wins / c.matches) * 100 : null),
        matchPerformance: ratingOnHundred(avg),
        previousRank: coachPrev.get(c.coachId) ?? null,
        trend: rankingTrend(c.ratings100.slice(0, 3), c.ratings100.slice(3)),
        recentRatings: padRefereeFormSeries(c.ratings100.slice(0, 5)),
        retired: isRankingRetired({ name: c.coachName }),
      };
    })
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.tournamentRating !== a.tournamentRating) return b.tournamentRating - a.tournamentRating;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.coachName.localeCompare(b.coachName);
    })
    .map((row, i) => {
      const rank = i + 1;
      const filled = fillDisplayMovement({
        rank,
        previousRank: row.previousRank,
        ratingsNewestFirst: row.recentRatings,
        avgRating: row.avgRating,
        clubPerformance: row.teamPerformance,
        internationalPerformance: row.tournamentPerformance,
        bestRating: row.bestRating,
      });
      return { ...row, rank, previousRank: filled.previousRank, trend: filled.movement };
    });

  return {
    ...empty,
    season: {
      id: season.id,
      label: season.label,
      year: season.year,
      isActive: season.isActive,
    },
    playersByPosition,
    playersOverall,
    teams: teamRows.slice(0, limit),
    referees: refereeRankings.slice(0, limit),
    coaches: coachRankings.slice(0, limit),
    coverage: {
      playerRatedMatches: playerRows.length,
      refereeRatedMatches: refRows.length,
      coachRatedMatches: coachRows.length,
    },
  };
}
