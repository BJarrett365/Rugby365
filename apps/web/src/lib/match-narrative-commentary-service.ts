import "server-only";
import { and, asc, desc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  matchCommentary,
  matchEvents,
  playerMatchPerformanceStats,
  playerMatchRatings,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { getFixtureById } from "./fixture-admin-service";
import {
  buildMatchNarrativeCommentary,
  competitionSuggestsRelegation,
  type NarrativeEventInput,
  type NarrativeHeadToHead,
  type NarrativeManOfTheMatch,
  type NarrativeMatchContext,
  type NarrativeMatchTeamStats,
  type NarrativeNextFixture,
  type NarrativePlayerStatHighlight,
  type NarrativeSquadPlayer,
  type NarrativeTableStanding,
  type NarrativeWeatherPitch,
  type NarrativeWinPrediction,
} from "./match-narrative-commentary";
import { normalizeTeamSideStats } from "./match-narrative-team-stats";
import { dedupeNarrativeEvents } from "./match-narrative-event-dedupe";
import { compareFixtureHeadToHead } from "./head-to-head-service";
import { findCatalogEntryForCompetitionName } from "./competition-catalog";
import { isFixtureRatingsPublished } from "./match-rating-math";
import { isStarterSquadRole } from "./match-stats-gap-fill";
import { calculateRugbyTable } from "./table-lab/table-calculation-service";
import { enrichScheduleFixturesWithWinProbability } from "./schedule-win-probability";
import type { ScheduleFixture } from "./match-schedule-utils";
import { getLatestOddsForFixture } from "./match-odds-service";
import { getFixtureTeamMatchStats } from "./team-match-stats-service";
import { resolveWeatherForVenueId } from "./venue-geocode-service";
import { weatherConditionFromText } from "./weather-condition";

const NARRATIVE_SOURCE = "match_narrative";
const MIN_PREVIOUS_STARTERS = 10;

const UPCOMING_FIXTURE_STATUSES = ["scheduled", "fixture", "upcoming"] as const;

/** Next scheduled fixture for a team after the current kick-off. */
async function loadNextFixtureForTeam(
  teamId: string,
  afterKickoff: Date | null | undefined,
  excludeFixtureId: string,
  teamName: string,
): Promise<NarrativeNextFixture | null> {
  if (!afterKickoff) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
        ne(fixtures.id, excludeFixtureId),
        gt(fixtures.kickoffAt, afterKickoff),
        inArray(fixtures.status, [...UPCOMING_FIXTURE_STATUSES]),
      ),
    )
    .orderBy(asc(fixtures.kickoffAt))
    .limit(1);

  if (!row?.homeTeamId || !row.awayTeamId) return null;
  const opponentId = row.homeTeamId === teamId ? row.awayTeamId : row.homeTeamId;
  const [opponent] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, opponentId))
    .limit(1);
  if (!opponent?.name) return null;
  return {
    teamName,
    opponentName: opponent.name,
    isHome: row.homeTeamId === teamId,
    kickoffAt: row.kickoffAt?.toISOString() ?? null,
    competitionName: row.competitionName,
  };
}

async function loadManOfTheMatch(
  fixtureId: string,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  homeName: string,
  awayName: string,
  homeScore = 0,
  awayScore = 0,
  rugby365PotmPlayerId?: string | null,
  officialPotmPlayerId?: string | null,
  tryEvents?: Array<{ playerName?: string | null; teamName?: string | null }>,
): Promise<NarrativeManOfTheMatch | null> {
  const db = getDb();
  const teamNameFor = (teamId: string) =>
    teamId === homeTeamId ? homeName : teamId === awayTeamId ? awayName : "Team";
  const teamScoreFor = (teamId: string) =>
    teamId === homeTeamId ? homeScore : teamId === awayTeamId ? awayScore : 0;
  const eventTryCount = new Map<string, number>();
  const seenTryKeys = new Set<string>();
  for (const event of tryEvents ?? []) {
    const name = event.playerName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    // Dedupe noisy duplicate try rows for the same scorer.
    const dedupe = `${key}|${(event as { minute?: number }).minute ?? ""}|${event.teamName ?? ""}`;
    if (seenTryKeys.has(dedupe)) continue;
    seenTryKeys.add(dedupe);
    eventTryCount.set(key, (eventTryCount.get(key) ?? 0) + 1);
  }
  const sanePerf = (row: {
    playerName: string;
    teamId: string;
    points: number;
    tries: number;
    metresCarried: number;
    tacklesMade: number;
    carries: number;
  }) => {
    const teamScore = teamScoreFor(row.teamId);
    const tryCeiling = teamScore > 0 ? Math.max(1, Math.ceil(teamScore / 5) + 1) : 8;
    let eventTries = eventTryCount.get(row.playerName.trim().toLowerCase()) ?? 0;
    eventTries = Math.min(eventTries, tryCeiling);
    let points = row.points;
    let tries = row.tries;
    if (teamScore > 0 && points > teamScore) points = 0;
    if (teamScore > 0 && tries * 5 > teamScore + 2) tries = eventTries;
    else if (eventTries > tries) tries = eventTries;
    tries = Math.min(tries, tryCeiling);
    if (points <= 0 && tries > 0) points = tries * 5;
    return { ...row, points, tries };
  };

  type Candidate = {
    playerId: string;
    playerName: string;
    teamId: string;
    rating: number | null;
    isPotm: boolean;
  };

  let candidates: Candidate[] = [];
  try {
    const ratingRows = await db
      .select({
        playerId: playerMatchRatings.playerId,
        playerName: players.name,
        teamId: playerMatchRatings.teamId,
        rating: playerMatchRatings.rating,
        manualOverrideRating: playerMatchRatings.manualOverrideRating,
        isRugby365Potm: playerMatchRatings.isRugby365Potm,
        isOfficialPotm: playerMatchRatings.isOfficialPotm,
      })
      .from(playerMatchRatings)
      .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
      .where(eq(playerMatchRatings.fixtureId, fixtureId));

    candidates = ratingRows.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      teamId: row.teamId,
      rating: row.manualOverrideRating ?? row.rating,
      isPotm:
        row.isRugby365Potm ||
        row.isOfficialPotm ||
        row.playerId === rugby365PotmPlayerId ||
        row.playerId === officialPotmPlayerId,
    }));
  } catch {
    /* ratings optional */
  }

  let chosen: Candidate | null =
    candidates.find((c) => c.isPotm) ??
    [...candidates]
      .filter((c) => c.rating != null && Number.isFinite(c.rating))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ??
    null;

  type PerfRow = {
    playerId: string;
    playerName: string;
    teamId: string;
    points: number;
    tries: number;
    metresCarried: number;
    tacklesMade: number;
    carries: number;
  };
  let perfRows: PerfRow[] = [];
  try {
    perfRows = await db
      .select({
        playerId: playerMatchPerformanceStats.playerId,
        playerName: players.name,
        teamId: playerMatchPerformanceStats.teamId,
        points: playerMatchPerformanceStats.points,
        tries: playerMatchPerformanceStats.tries,
        metresCarried: playerMatchPerformanceStats.metresCarried,
        tacklesMade: playerMatchPerformanceStats.tacklesMade,
        carries: playerMatchPerformanceStats.carries,
      })
      .from(playerMatchPerformanceStats)
      .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
      .where(eq(playerMatchPerformanceStats.fixtureId, fixtureId));
  } catch {
    /* performance optional */
  }

  if (!chosen && perfRows.length) {
    const scored = perfRows
      .map((row) => {
        const sane = sanePerf(row);
        return {
          row,
          score:
            sane.points * 12 +
            sane.tries * 20 +
            sane.metresCarried +
            sane.tacklesMade * 2 +
            sane.carries,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best) {
      chosen = {
        playerId: best.row.playerId,
        playerName: best.row.playerName,
        teamId: best.row.teamId,
        rating: null,
        isPotm: false,
      };
    }
  }

  if (!chosen && eventTryCount.size) {
    const top = [...eventTryCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const [nameKey, tries] = top;
      const event = (tryEvents ?? []).find(
        (e) => e.playerName?.trim().toLowerCase() === nameKey,
      );
      const teamName = event?.teamName?.trim() || "";
      const teamId =
        teamName === homeName
          ? (homeTeamId ?? "")
          : teamName === awayName
            ? (awayTeamId ?? "")
            : "";
      if (teamId && tries > 0) {
        chosen = {
          playerId: "",
          playerName: event?.playerName?.trim() || nameKey,
          teamId,
          rating: null,
          isPotm: false,
        };
      }
    }
  }

  if (!chosen) return null;

  const perfRaw = perfRows.find((row) => row.playerId === chosen!.playerId);
  const perf = perfRaw
    ? sanePerf(perfRaw)
    : sanePerf({
        playerName: chosen.playerName,
        teamId: chosen.teamId,
        points: 0,
        tries: 0,
        metresCarried: 0,
        tacklesMade: 0,
        carries: 0,
      });
  const reasons: string[] = [];
  if (chosen.rating != null && Number.isFinite(chosen.rating)) {
    reasons.push(`${chosen.rating.toFixed(1)} rating`);
  }
  if (perf.tries > 0) reasons.push(`${perf.tries} tr${perf.tries === 1 ? "y" : "ies"}`);
  if (perf.points > 0) reasons.push(`${perf.points} points`);
  if (perf.metresCarried >= 40) reasons.push(`${perf.metresCarried}m`);
  if (perf.tacklesMade >= 8) reasons.push(`${perf.tacklesMade} tackles`);
  if (!reasons.length) reasons.push("stood out across the eighty");

  return {
    playerName: chosen.playerName,
    teamName: teamNameFor(chosen.teamId),
    rating: chosen.rating,
    reasons,
  };
}

/** Most recent finished fixture with a usable starting XV for this team. */
async function loadPreviousStartingXvForTeam(
  teamId: string,
  beforeKickoff: Date | null | undefined,
  excludeFixtureId: string,
): Promise<NarrativeSquadPlayer[] | null> {
  if (!beforeKickoff) return null;
  const db = getDb();
  const candidates = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
        ne(fixtures.id, excludeFixtureId),
        lt(fixtures.kickoffAt, beforeKickoff),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(10);

  for (const candidate of candidates) {
    if (!isFixtureRatingsPublished(candidate.status)) continue;
    const rows = await db
      .select({
        playerId: fixturePlayers.playerId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        positionName: fixturePlayers.positionName,
        playerName: players.name,
      })
      .from(fixturePlayers)
      .innerJoin(players, eq(fixturePlayers.playerId, players.id))
      .where(
        and(eq(fixturePlayers.fixtureId, candidate.id), eq(fixturePlayers.teamId, teamId)),
      )
      .orderBy(asc(fixturePlayers.jerseyNumber));

    const starters = rows
      .filter((row) => isStarterSquadRole(row.squadRole, row.jerseyNumber))
      .map(
        (row): NarrativeSquadPlayer => ({
          playerId: row.playerId,
          jerseyNumber: row.jerseyNumber,
          name: row.playerName,
          positionName: row.positionName,
          squadRole: "starting",
        }),
      );
    if (starters.length >= MIN_PREVIOUS_STARTERS) return starters;
  }
  return null;
}

function payloadString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function payloadNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export async function loadNarrativeMatchContext(
  fixtureId: string,
): Promise<NarrativeMatchContext | null> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return null;

  const db = getDb();
  const squadRows = await db
    .select({
      teamId: fixturePlayers.teamId,
      playerId: fixturePlayers.playerId,
      jerseyNumber: fixturePlayers.jerseyNumber,
      squadRole: fixturePlayers.squadRole,
      positionName: fixturePlayers.positionName,
      playerName: players.name,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, fixtureId))
    .orderBy(asc(fixturePlayers.jerseyNumber));

  const toSquad = (teamId: string | null | undefined): NarrativeSquadPlayer[] =>
    squadRows
      .filter((row) => row.teamId === teamId)
      .map((row) => ({
        playerId: row.playerId,
        jerseyNumber: row.jerseyNumber,
        name: row.playerName,
        positionName: row.positionName,
        squadRole: row.squadRole,
      }));

  const [homePreviousSquad, awayPreviousSquad] = await Promise.all([
    fixture.homeTeamId
      ? loadPreviousStartingXvForTeam(fixture.homeTeamId, fixture.kickoffAt, fixtureId)
      : Promise.resolve(null),
    fixture.awayTeamId
      ? loadPreviousStartingXvForTeam(fixture.awayTeamId, fixture.kickoffAt, fixtureId)
      : Promise.resolve(null),
  ]);

  let weather: NarrativeWeatherPitch | null = null;
  try {
    if (fixture.venueId) {
      const resolved = await resolveWeatherForVenueId({
        venueId: fixture.venueId,
        kickoffAt: fixture.kickoffAt,
        geocodeIfMissing: true,
      });
      if (resolved) {
        weather = {
          conditionLabel: resolved.conditionLabel,
          temperatureC: resolved.temperatureC,
          windSpeedKmh: resolved.windSpeedKmh,
          windCompass: resolved.windCompass,
          precipitationMm: resolved.precipitationMm,
          summaryNote: fixture.weatherNote?.trim() || null,
        };
      }
    }
    if (!weather && fixture.weatherNote?.trim()) {
      const note = fixture.weatherNote.trim();
      const condition = weatherConditionFromText(note);
      weather = {
        conditionLabel: condition.label,
        summaryNote: note,
        temperatureC: null,
        windSpeedKmh: null,
        windCompass: null,
        precipitationMm: null,
      };
    }
  } catch {
    /* weather optional */
  }

  const eventRows = await db
    .select({
      minute: matchEvents.minute,
      second: matchEvents.second,
      eventType: matchEvents.eventType,
      teamId: matchEvents.teamId,
      playerId: matchEvents.playerId,
      payload: matchEvents.payload,
      playerName: players.name,
    })
    .from(matchEvents)
    .leftJoin(players, eq(matchEvents.playerId, players.id))
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.second), asc(matchEvents.sequenceNo));

  const homeName = fixture.homeTeam?.name ?? "Home";
  const awayName = fixture.awayTeam?.name ?? "Away";

  const rawEvents: NarrativeEventInput[] = eventRows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const teamName =
      row.teamId && row.teamId === fixture.homeTeamId
        ? homeName
        : row.teamId && row.teamId === fixture.awayTeamId
          ? awayName
          : payloadString(payload, "team_name", "teamName");
    const providerType = payloadString(payload, "type", "provider_type", "label");
    const scoreText = payloadString(payload, "score");
    const hasScorePayload =
      Boolean(scoreText) ||
      payloadNumber(payload, "home_score", "homeScore") != null ||
      payloadNumber(payload, "away_score", "awayScore") != null;
    // SDMS often stores award "Penalty" under event_type penalty_goal — prefer provider label
    // unless a score is attached (then it's a successful kick).
    let eventType = row.eventType;
    if (
      /penalty/i.test(eventType) &&
      providerType &&
      /^penalty$/i.test(providerType.trim()) &&
      !/goal/i.test(providerType)
    ) {
      eventType = hasScorePayload ? "penalty_goal" : "penalty_awarded";
    }
    const playerFromPayload = payloadString(payload, "player", "player_name", "playerName");
    return {
      minute: row.minute,
      second: row.second ?? 0,
      eventType,
      teamName,
      playerName: row.playerName ?? playerFromPayload,
      playerOn:
        /sub\s*on/i.test(providerType ?? "")
          ? playerFromPayload ?? row.playerName
          : payloadString(payload, "player_on", "playerOn", "player_on_name"),
      playerOff:
        /sub\s*off/i.test(providerType ?? "")
          ? playerFromPayload ?? row.playerName
          : payloadString(payload, "player_off", "playerOff", "player_off_name"),
      homeScore: payloadNumber(payload, "home_score", "homeScore"),
      awayScore: payloadNumber(payload, "away_score", "awayScore"),
      label: providerType,
    };
  });

  // Collapse duplicate CMS rows (dual rugby_data + SDMS imports) + pair Sub On/Off.
  const collapsed: NarrativeEventInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawEvents.length; i++) {
    const event = rawEvents[i]!;
    const key = [
      event.minute,
      event.second ?? 0,
      event.eventType,
      event.playerName ?? "",
      event.playerOn ?? "",
      event.playerOff ?? "",
      event.teamName ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    if (/sub|replacement/i.test(event.eventType)) {
      const pair = rawEvents.find((other, j) => {
        if (j === i) return false;
        if (other.minute !== event.minute || (other.second ?? 0) !== (event.second ?? 0)) return false;
        if (!/sub|replacement/i.test(other.eventType)) return false;
        if ((other.teamName ?? "") !== (event.teamName ?? "")) return false;
        return Boolean(
          (event.playerOn && other.playerOff) || (event.playerOff && other.playerOn),
        );
      });
      if (pair) {
        const pairedKey = [
          pair.minute,
          pair.second ?? 0,
          pair.eventType,
          pair.playerName ?? "",
          pair.playerOn ?? "",
          pair.playerOff ?? "",
          pair.teamName ?? "",
        ].join("|");
        if (seen.has(pairedKey)) continue; // already emitted with its pair
        seen.add(pairedKey);
        collapsed.push({
          ...event,
          eventType: "substitution",
          playerOn: event.playerOn ?? pair.playerOn ?? null,
          playerOff: event.playerOff ?? pair.playerOff ?? null,
          playerName: null,
        });
        continue;
      }
    }

    collapsed.push(event);
  }

  const events: NarrativeEventInput[] = dedupeNarrativeEvents(collapsed);

  const competitionName =
    fixture.competition?.name ?? fixture.competitionName ?? "Competition";

  let homeTable: NarrativeTableStanding | null = null;
  let awayTable: NarrativeTableStanding | null = null;
  let tableSize: number | null = null;
  const suggestsRelegation = competitionSuggestsRelegation(
    findCatalogEntryForCompetitionName(competitionName),
  );
  if (fixture.competitionId && fixture.seasonId) {
    try {
      const table = await calculateRugbyTable("live_table", {
        competitionId: fixture.competitionId,
        seasonId: fixture.seasonId,
        includeLiveMatches: true,
        includeScheduledMatches: false,
        showMovement: false,
      });
      tableSize = table.rows.length || null;
      const toStanding = (
        teamLabel: string,
        row: (typeof table.rows)[number],
      ): NarrativeTableStanding => ({
        teamName: teamLabel,
        rank: row.rank,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.leaguePoints,
        pointsDiff: row.pointsDiff,
      });
      const homeRow = table.rows.find((row) => row.teamId === fixture.homeTeamId);
      const awayRow = table.rows.find((row) => row.teamId === fixture.awayTeamId);
      if (homeRow) homeTable = toStanding(homeName, homeRow);
      if (awayRow) awayTable = toStanding(awayName, awayRow);
    } catch {
      /* table optional */
    }
  }

  let winPrediction: NarrativeWinPrediction | null = null;
  try {
    const scheduleRow: ScheduleFixture = {
      id: fixture.id,
      slug: fixture.slug,
      competitionId: fixture.competitionId,
      competitionName,
      matchDate: fixture.kickoffAt ? fixture.kickoffAt.toISOString().slice(0, 10) : null,
      seasonLabel: null,
      kickoffAt: fixture.kickoffAt?.toISOString() ?? null,
      status: fixture.status,
      round: fixture.round,
      venue: fixture.venueName ?? fixture.venue?.name ?? null,
      venueId: fixture.venueId,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      isNeutralVenue: Boolean(fixture.isNeutralVenue),
      homeTeam: fixture.homeTeam
        ? { id: fixture.homeTeam.id, name: homeName, slug: fixture.homeTeam.slug ?? null }
        : { id: fixture.homeTeamId, name: homeName, slug: null },
      awayTeam: fixture.awayTeam
        ? { id: fixture.awayTeam.id, name: awayName, slug: fixture.awayTeam.slug ?? null }
        : { id: fixture.awayTeamId, name: awayName, slug: null },
      source: "db",
    };
    const [enriched] = await enrichScheduleFixturesWithWinProbability([scheduleRow]);
    const wp = enriched?.winProbability;
    if (wp) {
      let favoriteName = homeName;
      if (wp.lean === "away") favoriteName = awayName;
      else if (wp.lean === "home") favoriteName = homeName;
      else if (wp.awayWinPct > wp.homeWinPct) favoriteName = awayName;
      else if (wp.homeWinPct > wp.awayWinPct) favoriteName = homeName;
      winPrediction = {
        favoriteName,
        homePercent: wp.homeWinPct,
        awayPercent: wp.awayWinPct,
        drawPercent: wp.drawPct,
      };
    }
  } catch {
    /* prediction optional */
  }

  // Fallback tip from table positions when model is unavailable.
  if (!winPrediction && homeTable && awayTable) {
    const favoriteName = homeTable.rank <= awayTable.rank ? homeName : awayName;
    winPrediction = {
      favoriteName,
      homePercent: homeTable.rank <= awayTable.rank ? 55 : 40,
      awayPercent: homeTable.rank <= awayTable.rank ? 40 : 55,
      drawPercent: 5,
    };
  }

  try {
    const odds = await getLatestOddsForFixture(fixtureId);
    if (odds && winPrediction) {
      const toPct = (implied: number | null | undefined, decimal: number | null | undefined) => {
        if (implied != null && Number.isFinite(implied)) {
          return implied <= 1 ? Math.round(implied * 100) : Math.round(implied);
        }
        if (decimal != null && decimal > 1) return Math.round((1 / decimal) * 100);
        return null;
      };
      winPrediction = {
        ...winPrediction,
        bookHomePercent: toPct(odds.impliedHome, odds.bestHomeDecimal),
        bookAwayPercent: toPct(odds.impliedAway, odds.bestAwayDecimal),
        bookDrawPercent: toPct(odds.impliedDraw, odds.bestDrawDecimal),
      };
    }
  } catch {
    /* bookmaker odds optional */
  }

  let headToHead: NarrativeHeadToHead | null = null;
  try {
    const comparison = await compareFixtureHeadToHead(fixtureId);
    const played = comparison.meetings.filter(
      (row) =>
        row.cmsFixtureId !== fixtureId &&
        row.homeScore != null &&
        row.awayScore != null &&
        row.status !== "scheduled" &&
        row.status !== "fixture" &&
        row.status !== "live",
    );
    headToHead = {
      totalMeetings: comparison.summary.totalMeetings,
      homeWins: comparison.summary.homeWins,
      awayWins: comparison.summary.awayWins,
      draws: comparison.summary.draws,
      recent: played.slice(0, 5).map((row) => ({
        date: row.date,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeScore: row.homeScore!,
        awayScore: row.awayScore!,
        competition: row.competition,
      })),
    };
  } catch {
    /* head-to-head optional */
  }

  let teamStats: NarrativeMatchTeamStats | null = null;
  try {
    const rows = await getFixtureTeamMatchStats(fixtureId);
    const homeRow =
      rows.find((row) => row.side === "home") ??
      rows.find((row) => row.teamId === fixture.homeTeamId);
    const awayRow =
      rows.find((row) => row.side === "away") ??
      rows.find((row) => row.teamId === fixture.awayTeamId);
    if (homeRow && awayRow) {
      teamStats = {
        home: normalizeTeamSideStats(homeRow),
        away: normalizeTeamSideStats(awayRow),
      };
    }
  } catch {
    /* team stats optional */
  }

  const playerStatHighlights: NarrativePlayerStatHighlight[] = [];
  try {
    const statRows = await db
      .select({
        playerName: players.name,
        teamId: playerMatchPerformanceStats.teamId,
        points: playerMatchPerformanceStats.points,
        tries: playerMatchPerformanceStats.tries,
        metresCarried: playerMatchPerformanceStats.metresCarried,
        tacklesMade: playerMatchPerformanceStats.tacklesMade,
        carries: playerMatchPerformanceStats.carries,
      })
      .from(playerMatchPerformanceStats)
      .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
      .where(eq(playerMatchPerformanceStats.fixtureId, fixtureId))
      .orderBy(desc(playerMatchPerformanceStats.points));

    const teamNameFor = (teamId: string) =>
      teamId === fixture.homeTeamId ? homeName : teamId === fixture.awayTeamId ? awayName : "Team";

    const teamScoreFor = (teamId: string) =>
      teamId === fixture.homeTeamId
        ? (fixture.homeScore ?? 0)
        : teamId === fixture.awayTeamId
          ? (fixture.awayScore ?? 0)
          : 0;

    const pickBest = (
      metric: "points" | "tries" | "metresCarried" | "tacklesMade" | "carries",
      label: string,
    ) => {
      let best: (typeof statRows)[number] | null = null;
      for (const row of statRows) {
        const teamScore = teamScoreFor(row.teamId);
        // Drop inflated provider totals that can't fit this team's score.
        if (metric === "points" && teamScore > 0 && row.points > teamScore) continue;
        if (metric === "tries" && teamScore > 0 && row.tries * 5 > teamScore + 2) continue;
        if (!best || row[metric] > best[metric]) best = row;
      }
      if (!best || best[metric] <= 0) return;
      if (playerStatHighlights.some((h) => h.playerName === best!.playerName && h.label === label)) {
        return;
      }
      playerStatHighlights.push({
        playerName: best.playerName,
        teamName: teamNameFor(best.teamId),
        label,
        value: best[metric],
      });
    };

    pickBest("points", "points");
    pickBest("tries", "tries");
    pickBest("metresCarried", "metres");
    pickBest("tacklesMade", "tackles");
    pickBest("carries", "carries");
  } catch {
    /* player stats optional */
  }

  const [homeNextFixture, awayNextFixture, manOfTheMatch] = await Promise.all([
    fixture.homeTeamId
      ? loadNextFixtureForTeam(fixture.homeTeamId, fixture.kickoffAt, fixtureId, homeName)
      : Promise.resolve(null),
    fixture.awayTeamId
      ? loadNextFixtureForTeam(fixture.awayTeamId, fixture.kickoffAt, fixtureId, awayName)
      : Promise.resolve(null),
    loadManOfTheMatch(
      fixtureId,
      fixture.homeTeamId,
      fixture.awayTeamId,
      homeName,
      awayName,
      fixture.homeScore ?? 0,
      fixture.awayScore ?? 0,
      fixture.rugby365PotmPlayerId,
      fixture.officialPotmPlayerId,
      events.filter((e) => {
        const type = e.eventType.toLowerCase().replace(/[\s-]+/g, "_");
        return type === "try" || (type.includes("try") && !type.includes("conversion"));
      }),
    ),
  ]);

  return {
    homeName,
    awayName,
    competitionName,
    round: fixture.round,
    venueName: fixture.venue?.name ?? fixture.venueName,
    refereeName: fixture.referee?.name ?? fixture.refereeName,
    homeCoachName: fixture.homeCoach?.name ?? null,
    awayCoachName: fixture.awayCoach?.name ?? null,
    homeSquad: toSquad(fixture.homeTeamId),
    awaySquad: toSquad(fixture.awayTeamId),
    homePreviousSquad,
    awayPreviousSquad,
    weather,
    headToHead,
    teamStats,
    events,
    finalHomeScore: fixture.homeScore,
    finalAwayScore: fixture.awayScore,
    status: fixture.status,
    homeTable,
    awayTable,
    tableSize,
    suggestsRelegation,
    homeNextFixture,
    awayNextFixture,
    manOfTheMatch,
    winPrediction,
    playerStatHighlights,
  };
}

export async function generateAndPublishMatchNarrativeCommentary(
  fixtureId: string,
  options?: { replace?: boolean; generateAudioScripts?: boolean },
): Promise<{
  created: number;
  lines: Array<{ minute: number; second: number; body: string; segment: string }>;
  audioScriptsCreated?: number;
}> {
  const ctx = await loadNarrativeMatchContext(fixtureId);
  if (!ctx) throw new Error("Fixture not found");

  const narrative = buildMatchNarrativeCommentary(ctx);
  const db = getDb();

  if (options?.replace !== false) {
    await db
      .delete(matchCommentary)
      .where(
        and(
          eq(matchCommentary.fixtureId, fixtureId),
          eq(matchCommentary.source, NARRATIVE_SOURCE),
        ),
      );
  }

  let created = 0;
  const lines: Array<{ minute: number; second: number; body: string; segment: string }> = [];

  const basePublishedAt = Date.now();
  for (const [index, line] of narrative.entries()) {
    await db.insert(matchCommentary).values({
      fixtureId,
      minute: line.minute,
      second: line.second,
      outputType: line.outputType,
      body: line.body,
      source: NARRATIVE_SOURCE,
      facts: {
        segment: line.segment,
        source: NARRATIVE_SOURCE,
        sequence: index,
        home_team: ctx.homeName,
        away_team: ctx.awayName,
        venue: ctx.venueName,
        referee: ctx.refereeName,
        competition: ctx.competitionName,
        round: ctx.round,
      },
      // Preserve broadcast order when minutes collide (welcome / referee / teams).
      publishedAt: new Date(basePublishedAt + index),
    });
    created += 1;
    lines.push({
      minute: line.minute,
      second: line.second,
      body: line.body,
      segment: line.segment,
    });
  }

  // Audio is a separate Lead + Analyst rewrite — never TTS of written prose.
  // Only activate when explicitly requested; otherwise clear so the public Audio tab stays off.
  let audioScriptsCreated: number | undefined;
  if (options?.generateAudioScripts === true) {
    const { generateAndStoreAudioScriptsForFixture } = await import(
      "./audio-commentary-script-service"
    );
    const audio = await generateAndStoreAudioScriptsForFixture(fixtureId, {
      replace: options?.replace !== false,
    });
    audioScriptsCreated = audio.created;
  } else if (options?.replace !== false) {
    const { clearAudioCommentaryScriptsForFixture } = await import(
      "./audio-commentary-script-service"
    );
    await clearAudioCommentaryScriptsForFixture(fixtureId);
    audioScriptsCreated = 0;
  }

  // Seed live-refresh signature so public polls do not rebuild until match state changes.
  const { markNarrativeCommentaryFresh } = await import("./match-narrative-live-refresh");
  await markNarrativeCommentaryFresh(fixtureId);

  return { created, lines, audioScriptsCreated };
}

export async function listMatchNarrativeCommentary(fixtureId: string) {
  const db = getDb();
  return db
    .select()
    .from(matchCommentary)
    .where(eq(matchCommentary.fixtureId, fixtureId))
    .orderBy(desc(matchCommentary.minute), desc(matchCommentary.publishedAt));
}
