/**
 * Pure builders for natural-flowing match commentary from structured fixture data.
 */

import {
  buildPrematchBettingIntelligenceLine,
  scoreAsOfMinute,
} from "./match-narrative-betting-intel";
import { buildIntelligenceInPlayCommentary } from "./match-narrative-intelligence-engine";
import type { NarrativeMatchTeamStats } from "./match-narrative-team-stats";

export type { NarrativeMatchTeamStats, NarrativeTeamSideStats } from "./match-narrative-team-stats";

export type NarrativeSquadPlayer = {
  playerId?: string | null;
  jerseyNumber: number | null;
  name: string;
  positionName?: string | null;
  squadRole: string;
};

export type NarrativeLineupChanges = {
  comingIn: string[];
  droppingOut: string[];
};

export type NarrativeEventInput = {
  minute: number;
  second?: number;
  eventType: string;
  teamName?: string | null;
  playerName?: string | null;
  playerOn?: string | null;
  playerOff?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Free-text label from payload (period names, etc.). */
  label?: string | null;
};

export type NarrativeTableStanding = {
  teamName: string;
  rank: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  points?: number;
  pointsDiff?: number;
};

export type NarrativeNextFixture = {
  teamName: string;
  opponentName: string;
  isHome: boolean;
  kickoffAt: string | null;
  competitionName?: string | null;
};

export type NarrativeManOfTheMatch = {
  playerName: string;
  teamName: string;
  rating?: number | null;
  /** Short reasons for the award (rating, tries, points, metres, tackles…). */
  reasons: string[];
};

export type NarrativePlayerStatHighlight = {
  playerName: string;
  teamName: string;
  label: string;
  value: number;
};

export type NarrativeWinPrediction = {
  favoriteName: string;
  homePercent: number;
  awayPercent: number;
  drawPercent?: number;
  /** Bookmaker implied win % (0–100) when odds snapshots exist. */
  bookHomePercent?: number | null;
  bookAwayPercent?: number | null;
  bookDrawPercent?: number | null;
};

export type NarrativeWeatherPitch = {
  conditionLabel?: string | null;
  temperatureC?: number | null;
  windSpeedKmh?: number | null;
  windCompass?: string | null;
  precipitationMm?: number | null;
  /** Free-text CMS / provider note when forecast is unavailable. */
  summaryNote?: string | null;
};

export type NarrativeHeadToHeadMeeting = {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition?: string | null;
};

export type NarrativeHeadToHead = {
  totalMeetings: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  /** Newest first. */
  recent: NarrativeHeadToHeadMeeting[];
};

export type NarrativeMatchContext = {
  homeName: string;
  awayName: string;
  competitionName: string;
  round?: string | null;
  venueName?: string | null;
  refereeName?: string | null;
  homeCoachName?: string | null;
  awayCoachName?: string | null;
  homeSquad: NarrativeSquadPlayer[];
  awaySquad: NarrativeSquadPlayer[];
  /** Starting XV from each team's previous finished match (for selection changes). */
  homePreviousSquad?: NarrativeSquadPlayer[] | null;
  awayPreviousSquad?: NarrativeSquadPlayer[] | null;
  weather?: NarrativeWeatherPitch | null;
  headToHead?: NarrativeHeadToHead | null;
  teamStats?: NarrativeMatchTeamStats | null;
  events: NarrativeEventInput[];
  finalHomeScore?: number;
  finalAwayScore?: number;
  status?: string | null;
  homeTable?: NarrativeTableStanding | null;
  awayTable?: NarrativeTableStanding | null;
  /** Total teams on the competition table (for top/bottom phrasing). */
  tableSize?: number | null;
  /**
   * When true, bottom-of-table lines may mention the drop / relegation pressure.
   * Closed leagues (Currie Cup, URC, etc.) should leave this false.
   */
  suggestsRelegation?: boolean;
  homeNextFixture?: NarrativeNextFixture | null;
  awayNextFixture?: NarrativeNextFixture | null;
  manOfTheMatch?: NarrativeManOfTheMatch | null;
  winPrediction?: NarrativeWinPrediction | null;
  playerStatHighlights?: NarrativePlayerStatHighlight[];
};

export type NarrativeCommentaryLine = {
  minute: number;
  second: number;
  outputType: string;
  body: string;
  segment: string;
};

function formatRound(round?: string | null): string {
  const r = (round ?? "").trim();
  if (!r) return "";
  if (/^round\b/i.test(r)) return r;
  if (/^\d+$/.test(r)) return `Round ${r}`;
  return r;
}

function competitionLabel(competitionName: string, round?: string | null): string {
  const roundLabel = formatRound(round);
  if (roundLabel) return `${competitionName} ${roundLabel}`;
  return competitionName;
}

export function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function isStarting(role: string): boolean {
  return /start/i.test(role);
}

function formatPlayerList(players: NarrativeSquadPlayer[]): string {
  return players
    .map((p) => {
      const num = p.jerseyNumber != null ? `${p.jerseyNumber} ` : "";
      return `${num}${p.name}`.trim();
    })
    .join(", ");
}

function sortSquad(players: NarrativeSquadPlayer[]): {
  starters: NarrativeSquadPlayer[];
  bench: NarrativeSquadPlayer[];
} {
  const starters = players
    .filter((p) => isStarting(p.squadRole))
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
  const bench = players
    .filter((p) => !isStarting(p.squadRole))
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
  return { starters, bench };
}

function starterKey(player: NarrativeSquadPlayer): string {
  const id = player.playerId?.trim();
  if (id) return `id:${id}`;
  return `name:${player.name.trim().toLowerCase()}`;
}

function formatNameList(names: string[], limit = 5): string {
  if (!names.length) return "";
  const capped = names.slice(0, limit);
  const extra = names.length - capped.length;
  if (capped.length === 1) return extra > 0 ? `${capped[0]} and ${extra} more` : capped[0]!;
  if (capped.length === 2 && extra === 0) return `${capped[0]} and ${capped[1]}`;
  const head = capped.slice(0, -1).join(", ");
  const tail = capped[capped.length - 1]!;
  if (extra > 0) return `${head}, ${tail} and ${extra} more`;
  return `${head} and ${tail}`;
}

/** Compare current XV to the previous outing; null when either side has no usable XV. */
export function diffStartingLineup(
  currentSquad: NarrativeSquadPlayer[],
  previousSquad: NarrativeSquadPlayer[] | null | undefined,
): NarrativeLineupChanges | null {
  if (!previousSquad?.length) return null;
  const currentStarters = sortSquad(currentSquad).starters;
  const previousStarters = sortSquad(previousSquad).starters;
  if (currentStarters.length < 10 || previousStarters.length < 10) return null;

  const previousKeys = new Set(previousStarters.map(starterKey));
  const currentKeys = new Set(currentStarters.map(starterKey));
  return {
    comingIn: currentStarters.filter((p) => !previousKeys.has(starterKey(p))).map((p) => p.name),
    droppingOut: previousStarters.filter((p) => !currentKeys.has(starterKey(p))).map((p) => p.name),
  };
}

export function formatLineupChangesFromLastGame(
  changes: NarrativeLineupChanges | null | undefined,
  coachName?: string | null,
): string {
  if (!changes) return "";
  const prefix = coachName?.trim()
    ? `Changes by ${coachName.trim()} from last time`
    : "Changes from last time";

  if (!changes.comingIn.length && !changes.droppingOut.length) {
    return ` Unchanged starting XV from last time.`;
  }

  if (changes.comingIn.length === 1 && changes.droppingOut.length === 1) {
    return ` ${prefix}: ${changes.comingIn[0]} comes in for ${changes.droppingOut[0]}.`;
  }

  if (
    changes.comingIn.length > 0 &&
    changes.comingIn.length === changes.droppingOut.length &&
    changes.comingIn.length <= 3
  ) {
    return ` ${prefix}: ${formatNameList(changes.comingIn)} come in for ${formatNameList(changes.droppingOut)}.`;
  }

  const bits: string[] = [];
  if (changes.comingIn.length) bits.push(`in: ${formatNameList(changes.comingIn)}`);
  if (changes.droppingOut.length) bits.push(`out: ${formatNameList(changes.droppingOut)}`);
  return ` ${prefix} — ${bits.join("; ")}.`;
}

function coachForTeam(ctx: NarrativeMatchContext, teamName: string): string | null {
  if (teamName === ctx.homeName) return ctx.homeCoachName?.trim() || null;
  if (teamName === ctx.awayName) return ctx.awayCoachName?.trim() || null;
  return null;
}

export function buildWelcomeLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine {
  const venue = ctx.venueName?.trim() || "the stadium";
  const comp = competitionLabel(ctx.competitionName, ctx.round);
  return {
    minute: 0,
    second: 0,
    outputType: "match_intro",
    segment: "welcome",
    body: `Welcome to ${venue}. It's ${comp} between ${ctx.homeName} and ${ctx.awayName}.`,
  };
}

export function buildRefereeLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine | null {
  const referee = ctx.refereeName?.trim();
  if (!referee) return null;
  return {
    minute: 0,
    second: 0,
    outputType: "match_intro",
    segment: "referee",
    body: `The referee today is ${referee}.`,
  };
}

function formatWindBit(weather: NarrativeWeatherPitch): string | null {
  const speed = weather.windSpeedKmh;
  if (speed == null || !Number.isFinite(speed)) return null;
  const compass = weather.windCompass?.trim();
  const from = compass ? ` from the ${compass}` : "";
  if (speed < 8) return `barely a breeze${from}`;
  if (speed < 18) return `a light breeze${from} around ${Math.round(speed)} km/h`;
  if (speed < 30) return `a freshening wind${from} around ${Math.round(speed)} km/h`;
  return `a strong wind${from} around ${Math.round(speed)} km/h`;
}

/** Infer how the surface will play from rain / condition text. */
export function inferPitchCondition(weather: NarrativeWeatherPitch): string {
  const text = `${weather.conditionLabel ?? ""} ${weather.summaryNote ?? ""}`.toLowerCase();
  const precip = weather.precipitationMm ?? 0;
  if (/thunder|storm|heavy rain|pour|blizzard/.test(text) || precip >= 5) {
    return "The pitch looks soft and slippery underfoot.";
  }
  if (/rain|drizzle|shower|wet|snow|sleet/.test(text) || precip >= 0.5) {
    return "The surface could be a little greasy.";
  }
  if (/fog|mist/.test(text)) {
    return "The pitch itself looks firm enough.";
  }
  return "The pitch looks firm and dry.";
}

export function buildWeatherPitchLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine | null {
  const weather = ctx.weather;
  if (!weather) return null;

  const bits: string[] = [];
  const note = weather.summaryNote?.trim();
  const condition = weather.conditionLabel?.trim();
  if (note && (!condition || note.toLowerCase() !== condition.toLowerCase())) {
    bits.push(note.replace(/\.$/, ""));
  } else if (condition && !/^weather$/i.test(condition)) {
    bits.push(condition.toLowerCase());
  }
  if (weather.temperatureC != null && Number.isFinite(weather.temperatureC)) {
    bits.push(`${Math.round(weather.temperatureC)}°C`);
  }
  const wind = formatWindBit(weather);
  if (wind) bits.push(`with ${wind}`);

  if (!bits.length && weather.precipitationMm == null) return null;

  const venueBit = ctx.venueName?.trim() ? ` at ${ctx.venueName.trim()}` : "";
  const weatherBit = bits.length ? `${bits.join(", ")}. ` : "";
  const pitch = inferPitchCondition(weather);

  return {
    minute: 0,
    second: 0,
    outputType: "match_fact",
    segment: "weather_pitch",
    body: `Weather and pitch update${venueBit}: ${weatherBit}${pitch}`,
  };
}

function formRecordBit(standing: NarrativeTableStanding): string {
  if (standing.won == null && standing.drawn == null && standing.lost == null) return "";
  const w = standing.won ?? 0;
  const d = standing.drawn ?? 0;
  const l = standing.lost ?? 0;
  return ` (W${w} D${d} L${l})`;
}

/** Closed / no-relegation leagues — use foot-of-table wording, not "the drop". */
const NO_RELEGATION_CATALOG_KEYS = new Set([
  "currie-cup-premier",
  "currie-cup-first",
  "urc",
  "super-rugby",
  "super-rugby-pacific",
  "npc",
  "mlr",
  "premiership-rugby", // relegation currently suspended
  "six-nations",
  "rugby-championship",
  "rugby-world-cup",
]);

/** Whether bottom-table lines may mention avoiding the drop. */
export function competitionSuggestsRelegation(entry: {
  key: string;
  format: string;
  competitionType: string;
  level: string;
  region: string;
} | null): boolean {
  if (!entry) return false;
  if (entry.format !== "league") return false;
  if (entry.competitionType !== "domestic") return false;
  if (NO_RELEGATION_CATALOG_KEYS.has(entry.key)) return false;
  if (entry.level === "national_2" || entry.level === "national_3") return true;
  if (entry.level === "national_top" && entry.region === "europe") return true;
  return false;
}

/** Rank 1–3 counts as near the top of the table. */
export function isNearTopOfTable(rank: number): boolean {
  return Number.isFinite(rank) && rank >= 1 && rank <= 3;
}

/** Bottom 2–3 places (2 on tiny tables, otherwise last three). */
export function isNearBottomOfTable(rank: number, tableSize: number): boolean {
  if (!Number.isFinite(rank) || !Number.isFinite(tableSize) || tableSize < 4) return false;
  const band = tableSize <= 5 ? 2 : 3;
  return rank > tableSize - band;
}

export function isBottomHalfOfTable(rank: number, tableSize: number): boolean {
  if (!Number.isFinite(rank) || !Number.isFinite(tableSize) || tableSize < 4) return false;
  return rank > Math.ceil(tableSize / 2);
}

function describeBottomPressure(
  teamName: string,
  rank: number,
  tableSize: number,
  suggestsRelegation: boolean,
): string {
  const place = ordinal(rank);
  if (suggestsRelegation && isNearBottomOfTable(rank, tableSize)) {
    return `${teamName} are fighting at the bottom of the table in ${place}, looking to avoid the drop`;
  }
  if (isNearBottomOfTable(rank, tableSize)) {
    return `${teamName} are sitting near the foot of the table in ${place}`;
  }
  if (isBottomHalfOfTable(rank, tableSize)) {
    return `${teamName} sit in the bottom half in ${place}`;
  }
  return `${teamName} sit ${place}`;
}

function describeTopRace(teamName: string, rank: number, competitionName: string): string {
  if (rank === 1) {
    return `${teamName} come into this perched at the top of the ${competitionName} table in 1st`;
  }
  return `${teamName} come into this near the top of the ${competitionName} table in ${ordinal(rank)}`;
}

export function buildTablePositionLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine | null {
  const home = ctx.homeTable;
  const away = ctx.awayTable;
  if (!home && !away) return null;

  const bits: string[] = [];
  if (home) {
    const placeLead = isNearTopOfTable(home.rank)
      ? describeTopRace(ctx.homeName, home.rank, ctx.competitionName)
      : `${ctx.homeName} come into this ${ordinal(home.rank)} on the ${ctx.competitionName} table`;
    const pointsBit = home.points != null ? ` on ${home.points} points` : "";
    bits.push(`${placeLead}${pointsBit}${formRecordBit(home)}`);
  }
  if (away) {
    const awayLead = isNearTopOfTable(away.rank)
      ? `${ctx.awayName} sit near the top in ${ordinal(away.rank)}`
      : `${ctx.awayName} sit ${ordinal(away.rank)}`;
    bits.push(
      `${awayLead}${away.points != null ? ` with ${away.points} points` : ""}${formRecordBit(away)}`,
    );
  }
  if (!bits.length) return null;
  return {
    minute: 0,
    second: 0,
    outputType: "match_fact",
    segment: "table_positions",
    body: `${bits.join(". ")}.`,
  };
}

/** Extra pre-match colour when either side is near the summit or the foot. */
export function buildTableContentionLines(ctx: NarrativeMatchContext): NarrativeCommentaryLine[] {
  const tableSize = ctx.tableSize ?? 0;
  const suggestsRelegation = Boolean(ctx.suggestsRelegation);
  const lines: NarrativeCommentaryLine[] = [];

  const topTeams: string[] = [];
  for (const [name, standing] of [
    [ctx.homeName, ctx.homeTable] as const,
    [ctx.awayName, ctx.awayTable] as const,
  ]) {
    if (standing && isNearTopOfTable(standing.rank)) {
      topTeams.push(
        standing.rank === 1 ? `${name} (1st)` : `${name} (${ordinal(standing.rank)})`,
      );
    }
  }
  if (topTeams.length === 1) {
    lines.push({
      minute: 0,
      second: 0,
      outputType: "match_fact",
      segment: "table_top",
      body: `${topTeams[0]} are in the mix at the top of the ${ctx.competitionName} — every result matters in that chase.`,
    });
  } else if (topTeams.length === 2) {
    lines.push({
      minute: 0,
      second: 0,
      outputType: "match_fact",
      segment: "table_top",
      body: `Both sides sit near the top of the ${ctx.competitionName} table — ${topTeams.join(" and ")} — so this has real summit implications.`,
    });
  }

  const bottomBits: string[] = [];
  for (const [name, standing] of [
    [ctx.homeName, ctx.homeTable] as const,
    [ctx.awayName, ctx.awayTable] as const,
  ]) {
    if (!standing || tableSize < 4) continue;
    if (isNearBottomOfTable(standing.rank, tableSize)) {
      bottomBits.push(
        describeBottomPressure(name, standing.rank, tableSize, suggestsRelegation),
      );
    } else if (isBottomHalfOfTable(standing.rank, tableSize) && !isNearTopOfTable(standing.rank)) {
      bottomBits.push(`${name} sit in the bottom half in ${ordinal(standing.rank)}`);
    }
  }

  if (bottomBits.length) {
    lines.push({
      minute: 0,
      second: 0,
      outputType: "match_fact",
      segment: "table_bottom",
      body: `${bottomBits.join(". ")}.`,
    });
  }

  return lines;
}

function formatFixtureKickoffDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function buildNextFixtureLine(
  next: NarrativeNextFixture,
  minute: number,
  second = 0,
): NarrativeCommentaryLine {
  const when = formatFixtureKickoffDate(next.kickoffAt);
  const venueBit = next.isHome ? "at home" : "away";
  const whenBit = when ? ` on ${when}` : "";
  const compBit = next.competitionName?.trim() ? ` in the ${next.competitionName.trim()}` : "";
  return {
    minute,
    second,
    outputType: "match_fact",
    segment: "next_fixture",
    body: `Next up for ${next.teamName}: ${venueBit} against ${next.opponentName}${whenBit}${compBit}.`,
  };
}

export function buildNextFixtureLines(
  ctx: NarrativeMatchContext,
  minute: number,
): NarrativeCommentaryLine[] {
  const lines: NarrativeCommentaryLine[] = [];
  if (ctx.homeNextFixture) {
    lines.push(buildNextFixtureLine(ctx.homeNextFixture, minute, 0));
  }
  if (ctx.awayNextFixture) {
    lines.push(buildNextFixtureLine(ctx.awayNextFixture, minute, ctx.homeNextFixture ? 1 : 0));
  }
  return lines;
}

export function buildManOfTheMatchLine(
  ctx: NarrativeMatchContext,
  minute: number,
): NarrativeCommentaryLine | null {
  const motm = ctx.manOfTheMatch;
  if (!motm?.playerName) return null;

  const reasonBits = motm.reasons.filter(Boolean).slice(0, 4);
  const why = reasonBits.length ? ` — ${reasonBits.join(", ")}` : "";
  const ratingBit =
    motm.rating != null && Number.isFinite(motm.rating) && !reasonBits.some((r) => /rating/i.test(r))
      ? ` with a ${motm.rating.toFixed(1)} rating`
      : "";

  return {
    minute,
    second: 2,
    outputType: "match_fact",
    segment: "man_of_the_match",
    body: `Man of the Match is ${motm.playerName} (${motm.teamName})${ratingBit}${why}.`,
  };
}

/** FULL-TIME whistle + short story of how the match unfolded. */
export function buildFullTimeSummaryLine(
  ctx: NarrativeMatchContext,
  minute = 80,
): NarrativeCommentaryLine | null {
  const home = ctx.finalHomeScore;
  const away = ctx.finalAwayScore;
  if (home == null || away == null) return null;

  const ht = scoreAsOfMinute(ctx.events, ctx.homeName, ctx.awayName, 40);
  const winner =
    home > away ? ctx.homeName : away > home ? ctx.awayName : null;
  const margin = Math.abs(home - away);

  let story: string;
  if (winner == null) {
    story = `A share of the spoils at ${ctx.venueName?.trim() || "the ground"} — ${ctx.homeName} and ${ctx.awayName} couldn't be separated.`;
  } else {
    const htLeader =
      ht.home > ht.away ? ctx.homeName : ht.away > ht.home ? ctx.awayName : null;
    let arc: string;
    if (htLeader && htLeader !== winner) {
      arc = `${winner} turned it around after trailing at the break (${ht.home}–${ht.away})`;
    } else if (htLeader === winner) {
      arc = `${winner} controlled the key moments after leading ${ht.home}–${ht.away} at half-time`;
    } else if (ht.home === ht.away && ht.home + ht.away > 0) {
      arc = `${winner} found the edge after a level first half (${ht.home}–${ht.away})`;
    } else {
      arc = `${winner} took the ${margin}-point win`;
    }

    const motm = ctx.manOfTheMatch?.playerName;
    const motmBit = motm ? `, with ${motm} influential` : "";
    const tries =
      ctx.teamStats != null
        ? ` Tries finished ${ctx.teamStats.home.tries}–${ctx.teamStats.away.tries}.`
        : "";
    story = `${arc}${motmBit}.${tries}`;
  }

  return {
    minute,
    second: 0,
    outputType: "score_update",
    segment: "full_time_summary",
    body: `FULL-TIME — ${ctx.homeName} ${home}–${away} ${ctx.awayName}. ${story}`,
  };
}

export function buildPredictionLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine | null {
  const prediction = ctx.winPrediction;
  if (!prediction?.favoriteName) return null;
  return buildPrematchBettingIntelligenceLine({
    homeName: ctx.homeName,
    awayName: ctx.awayName,
    prematch: prediction,
  });
}

function formatH2hDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function describeMeetingResult(
  meeting: NarrativeHeadToHeadMeeting,
  fixtureHome: string,
  fixtureAway: string,
): string {
  const score = `${meeting.homeTeam} ${meeting.homeScore}–${meeting.awayScore} ${meeting.awayTeam}`;
  const homeWon = meeting.homeScore > meeting.awayScore;
  const draw = meeting.homeScore === meeting.awayScore;
  if (draw) return `${score} — they shared the spoils`;

  const winner = homeWon ? meeting.homeTeam : meeting.awayTeam;
  if (winner.toLowerCase() === fixtureHome.toLowerCase()) {
    return `${score} — ${fixtureHome} took the points`;
  }
  if (winner.toLowerCase() === fixtureAway.toLowerCase()) {
    return `${score} — ${fixtureAway} came out on top`;
  }
  return score;
}

/** Pre-kick-off head-to-head history (summary + last meeting). */
export function buildHeadToHeadLines(ctx: NarrativeMatchContext): NarrativeCommentaryLine[] {
  const h2h = ctx.headToHead;
  if (!h2h) return [];

  const lines: NarrativeCommentaryLine[] = [];

  if (h2h.totalMeetings <= 0) {
    lines.push({
      minute: 0,
      second: 0,
      outputType: "match_fact",
      segment: "head_to_head",
      body: `Looking at previous head to heads — this looks like a first meeting between ${ctx.homeName} and ${ctx.awayName}.`,
    });
    return lines;
  }

  const drawBit =
    h2h.draws > 0
      ? `, with ${h2h.draws} draw${h2h.draws === 1 ? "" : "s"}`
      : "";
  lines.push({
    minute: 0,
    second: 0,
    outputType: "match_fact",
    segment: "head_to_head",
    body: `Looking at previous head to heads: ${ctx.homeName} have won ${h2h.homeWins}, ${ctx.awayName} have won ${h2h.awayWins}${drawBit}, across ${h2h.totalMeetings} meeting${h2h.totalMeetings === 1 ? "" : "s"}.`,
  });

  const last = h2h.recent[0];
  if (last) {
    const when = formatH2hDate(last.date);
    const comp = last.competition?.trim();
    const whenBit = when ? ` on ${when}` : "";
    const compBit = comp ? ` (${comp})` : "";
    lines.push({
      minute: 0,
      second: 0,
      outputType: "match_fact",
      segment: "head_to_head_last",
      body: `Last time they met${whenBit}${compBit}: ${describeMeetingResult(last, ctx.homeName, ctx.awayName)}.`,
    });
  }

  if (h2h.recent.length >= 2) {
    const extras = h2h.recent.slice(1, 3).map((m) => {
      const when = formatH2hDate(m.date);
      return `${when ? `${when}: ` : ""}${m.homeTeam} ${m.homeScore}–${m.awayScore} ${m.awayTeam}`;
    });
    if (extras.length) {
      lines.push({
        minute: 0,
        second: 0,
        outputType: "match_fact",
        segment: "head_to_head_recent",
        body: `Recent meetings also include ${extras.join("; ")}.`,
      });
    }
  }

  return lines;
}

export function buildTeamAnnouncementLine(
  teamName: string,
  coachName: string | null | undefined,
  squad: NarrativeSquadPlayer[],
  side: "home" | "away",
  previousSquad?: NarrativeSquadPlayer[] | null,
): NarrativeCommentaryLine | null {
  const { starters, bench } = sortSquad(squad);
  if (!starters.length) return null;

  const coachBit = coachName?.trim() ? `, managed by ${coachName.trim()}` : "";
  const opener =
    side === "home"
      ? `First, the home side — ${teamName}${coachBit}.`
      : `And the visitors — ${teamName}${coachBit}.`;
  const xv = `Starting XV: ${formatPlayerList(starters)}.`;
  const replacements = bench.length ? ` On the bench: ${formatPlayerList(bench)}.` : "";
  const selectionChanges = formatLineupChangesFromLastGame(
    diffStartingLineup(squad, previousSquad),
    coachName,
  );

  return {
    minute: 0,
    second: 0,
    outputType: "team_announcement",
    segment: side === "home" ? "team_announcement_home" : "team_announcement_away",
    body: `${opener} ${xv}${replacements}${selectionChanges}`,
  };
}

/** True when the fixture has not started — Generate should stay pre-match only. */
export function isPreMatchNarrativeStatus(status?: string | null): boolean {
  const s = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (
    !s ||
    s === "scheduled" ||
    s === "fixture" ||
    s === "upcoming" ||
    s === "not_started" ||
    s === "pre_match" ||
    s === "prematch" ||
    s === "postponed" ||
    s === "cancelled"
  );
}

/**
 * Highest match minute the narrative may treat as "reached".
 * Fabricated story beats must not exceed this.
 */
export function narrativeProgressMinute(ctx: NarrativeMatchContext): number {
  const eventMax = ctx.events.reduce((m, e) => Math.max(m, e.minute), 0);
  const s = (ctx.status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (/full_time|finished|result|complete/.test(s)) return Math.max(eventMax, 80);
  if (s === "half_time" || s === "ht") return Math.max(eventMax, 40);
  if (/second_half/.test(s)) return Math.max(eventMax, 41);
  if (/live|first_half|in_play|inplay/.test(s)) return Math.max(eventMax, 1);
  return eventMax;
}

export function buildKickOffLine(ctx: NarrativeMatchContext): NarrativeCommentaryLine {
  const venueBit = ctx.venueName?.trim() ? ` at ${ctx.venueName.trim()}` : "";
  return {
    minute: 1,
    second: 0,
    outputType: "phase_play_update",
    segment: "kick_off",
    body: `1' — And we're underway${venueBit}! ${ctx.homeName} versus ${ctx.awayName}.`,
  };
}

export function buildPlayerStatsLine(
  ctx: NarrativeMatchContext,
  minute: number,
  second = 0,
): NarrativeCommentaryLine | null {
  const highlights = ctx.playerStatHighlights ?? [];
  if (!highlights.length) return null;
  const parts = highlights.slice(0, 4).map((h) => {
    const unit = /metre/i.test(h.label) ? "m" : "";
    return `${h.playerName} (${h.teamName}) leads ${h.label.toLowerCase()} with ${h.value}${unit}`;
  });
  return {
    minute,
    second,
    outputType: "match_fact",
    segment: "player_stats",
    body: `Player stats watch: ${parts.join("; ")}.`,
  };
}

function scoreSuffix(ctx: NarrativeMatchContext, homeScore: number, awayScore: number): string {
  return ` ${ctx.homeName} ${homeScore}–${awayScore} ${ctx.awayName}.`;
}

function applyScoreDelta(
  ctx: NarrativeMatchContext,
  running: { home: number; away: number },
  event: NarrativeEventInput,
  delta: number,
) {
  const before = { ...running };
  if (typeof event.homeScore === "number" && typeof event.awayScore === "number") {
    if (
      ctx.finalHomeScore != null &&
      ctx.finalAwayScore != null &&
      (event.homeScore > ctx.finalHomeScore || event.awayScore > ctx.finalAwayScore)
    ) {
      return;
    }
    running.home = event.homeScore;
    running.away = event.awayScore;
  } else {
    const team = (event.teamName ?? "").trim();
    if (team === ctx.homeName) running.home += delta;
    else if (team === ctx.awayName) running.away += delta;
  }

  if (
    ctx.finalHomeScore != null &&
    ctx.finalAwayScore != null &&
    (running.home > ctx.finalHomeScore || running.away > ctx.finalAwayScore)
  ) {
    running.home = before.home;
    running.away = before.away;
  }
}

/** Colour / momentum reaction after the scoreboard moves. */
export function buildMomentumLine(
  ctx: NarrativeMatchContext,
  minute: number,
  running: { home: number; away: number },
): NarrativeCommentaryLine | null {
  if (running.home === running.away) {
    return {
      minute,
      second: 2,
      outputType: "phase_play_update",
      segment: "momentum",
      body: `${minute}' — All square — this is wide open.`,
    };
  }

  const leading = running.home > running.away ? ctx.homeName : ctx.awayName;
  const trailing = running.home > running.away ? ctx.awayName : ctx.homeName;
  const trailingCoach =
    trailing === ctx.homeName ? ctx.homeCoachName?.trim() : ctx.awayCoachName?.trim();
  const margin = Math.abs(running.home - running.away);

  const lookingGood =
    margin >= 10
      ? `${leading} are looking very good from here.`
      : `${leading} are looking good.`;
  const needResponse = trailingCoach
    ? `${trailing} and ${trailingCoach} have to do something about this.`
    : `${trailing} have to do something about this.`;

  return {
    minute,
    second: 2,
    outputType: "phase_play_update",
    segment: "momentum",
    body: `${minute}' — ${lookingGood} ${needResponse}`,
  };
}

export function buildEventNarrativeLine(
  ctx: NarrativeMatchContext,
  event: NarrativeEventInput,
  running: { home: number; away: number },
): NarrativeCommentaryLine | null {
  const type = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");
  const minute = Math.max(0, event.minute);
  const second = Math.max(0, Math.min(59, event.second ?? 0));
  const team = (event.teamName ?? "").trim();
  const player = (event.playerName ?? "").trim();
  const label = (event.label ?? "").trim();
  const periodText = `${type} ${label} ${player}`;
  const prevHome = running.home;
  const prevAway = running.away;

  let body: string | null = null;
  let outputType = "phase_play_update";
  let scored = false;

  if (type.includes("penalty_try")) {
    applyScoreDelta(ctx, running, event, 7);
    scored = running.home !== prevHome || running.away !== prevAway;
    body = `${minute}' — Penalty try for ${team || "the attacking side"}!${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (type === "try" || (type.includes("try") && !type.includes("conversion"))) {
    applyScoreDelta(ctx, running, event, 5);
    scored = true;
    body = player
      ? `${minute}' — TRY! ${player} crosses for ${team || "their side"}.${scoreSuffix(ctx, running.home, running.away)}`
      : `${minute}' — TRY for ${team || "the attacking side"}!${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (type.includes("missed_conversion") || (type.includes("conversion") && type.includes("miss"))) {
    body = player
      ? `${minute}' — ${player} pushes the conversion wide.`
      : `${minute}' — The conversion is missed.`;
  } else if (type.includes("conversion")) {
    applyScoreDelta(ctx, running, event, 2);
    scored = running.home !== prevHome || running.away !== prevAway;
    body = player
      ? `${minute}' — ${player} adds the extras.${scoreSuffix(ctx, running.home, running.away)}`
      : `${minute}' — Conversion good.${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (type.includes("penalty_goal")) {
    applyScoreDelta(ctx, running, event, 3);
    scored = true;
    body = player
      ? `${minute}' — ${player} slots the penalty for ${team || "their side"}.${scoreSuffix(ctx, running.home, running.away)}`
      : `${minute}' — Penalty goal for ${team || "the kicking side"}.${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (type === "penalty" || type.includes("penalty_awarded")) {
    body = `${minute}' — Penalty awarded to ${team || "the attacking side"}.`;
  } else if (type.includes("drop_goal")) {
    applyScoreDelta(ctx, running, event, 3);
    scored = true;
    body = player
      ? `${minute}' — Drop goal! ${player} for ${team || "their side"}.${scoreSuffix(ctx, running.home, running.away)}`
      : `${minute}' — Drop goal for ${team || "the kicking side"}.${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (type.includes("yellow")) {
    body = player
      ? `${minute}' — Yellow card for ${player}${team ? ` (${team})` : ""}.`
      : `${minute}' — Yellow card shown${team ? ` to ${team}` : ""}.`;
  } else if (type.includes("red")) {
    body = player
      ? `${minute}' — Red card! ${player} is sent off${team ? ` for ${team}` : ""}.`
      : `${minute}' — Red card shown${team ? ` to ${team}` : ""}.`;
  } else if (type.includes("sub") || type.includes("replacement")) {
    const on = (event.playerOn ?? player).trim();
    const off = (event.playerOff ?? "").trim();
    const coach = coachForTeam(ctx, team);
    const byCoach = coach ? `Changes by ${coach}` : `Changes for ${team || "the side"}`;
    if (on && off) {
      body = `${minute}' — ${byCoach}: ${on} on for ${off}.`;
    } else if (on) {
      body = `${minute}' — ${byCoach}: ${on} comes on.`;
    } else {
      return null;
    }
  } else if (type.includes("half_time") || /first.?half.?end|half.?time/i.test(periodText)) {
    body = `${minute}' — Half-time at ${ctx.venueName?.trim() || "the ground"}.${scoreSuffix(ctx, running.home, running.away)}`;
    outputType = "score_update";
  } else if (/second.?half.?start/i.test(periodText) || type.includes("second_half_start")) {
    body = `${minute}' — Second half underway. ${ctx.homeName} ${running.home}–${running.away} ${ctx.awayName}.`;
  } else if (type.includes("full_time") || type === "ft" || type.includes("end_of_match")) {
    const home = ctx.finalHomeScore ?? running.home;
    const away = ctx.finalAwayScore ?? running.away;
    body = `FULL-TIME — ${ctx.homeName} ${home}–${away} ${ctx.awayName}.`;
    outputType = "score_update";
  } else if (type === "period") {
    if (/first.?half.?end|half.?time/i.test(periodText)) {
      body = `${minute}' — Half-time at ${ctx.venueName?.trim() || "the ground"}.${scoreSuffix(ctx, running.home, running.away)}`;
      outputType = "score_update";
    } else if (/second.?half.?start/i.test(periodText)) {
      body = `${minute}' — Second half underway. ${ctx.homeName} ${running.home}–${running.away} ${ctx.awayName}.`;
    } else {
      return null;
    }
  } else {
    return null;
  }

  // Attach scored flag via unused var for callers — return body only.
  void scored;

  return {
    minute,
    second,
    outputType,
    segment: "match_event",
    body,
  };
}

/** Build the full narrative script in broadcast order. */
export function buildMatchNarrativeCommentary(
  ctx: NarrativeMatchContext,
): NarrativeCommentaryLine[] {
  const lines: NarrativeCommentaryLine[] = [];

  lines.push(buildWelcomeLine(ctx));
  const referee = buildRefereeLine(ctx);
  if (referee) lines.push(referee);

  const weatherPitch = buildWeatherPitchLine(ctx);
  if (weatherPitch) lines.push(weatherPitch);

  const tableLine = buildTablePositionLine(ctx);
  if (tableLine) lines.push(tableLine);
  lines.push(...buildTableContentionLines(ctx));

  const prediction = buildPredictionLine(ctx);
  if (prediction) lines.push(prediction);

  lines.push(...buildHeadToHeadLines(ctx));

  const homeAnnounce = buildTeamAnnouncementLine(
    ctx.homeName,
    ctx.homeCoachName,
    ctx.homeSquad,
    "home",
    ctx.homePreviousSquad,
  );
  if (homeAnnounce) lines.push(homeAnnounce);

  const awayAnnounce = buildTeamAnnouncementLine(
    ctx.awayName,
    ctx.awayCoachName,
    ctx.awaySquad,
    "away",
    ctx.awayPreviousSquad,
  );
  if (awayAnnounce) lines.push(awayAnnounce);

  // Scheduled / not kicked off with no timed events: pre-match pack only.
  const preMatch =
    isPreMatchNarrativeStatus(ctx.status) && narrativeProgressMinute(ctx) <= 0;
  if (!preMatch) {
    lines.push(buildKickOffLine(ctx));
    lines.push(...buildIntelligenceInPlayCommentary(ctx));
  }

  const shouldCloseGame =
    /full_time|finished|result|complete/i.test(ctx.status ?? "") &&
    ctx.finalHomeScore != null &&
    ctx.finalAwayScore != null;

  if (shouldCloseGame) {
    // MOTM + next fixtures after the FT match story (engine already wrote the report).
    if (!lines.some((l) => l.segment === "man_of_the_match")) {
      const motm = buildManOfTheMatchLine(ctx, 80);
      if (motm) lines.push(motm);
    }
    if (!lines.some((l) => l.segment === "next_fixture")) {
      lines.push(...buildNextFixtureLines(ctx, 80));
    }
  }

  return lines;
}
