import { describe, expect, it } from "vitest";
import {
  buildHeadToHeadLines,
  buildKickOffLine,
  buildManOfTheMatchLine,
  buildMatchNarrativeCommentary,
  buildNextFixtureLines,
  buildPredictionLine,
  buildRefereeLine,
  buildTableContentionLines,
  buildTablePositionLine,
  buildTeamAnnouncementLine,
  buildWeatherPitchLine,
  buildWelcomeLine,
  diffStartingLineup,
  formatLineupChangesFromLastGame,
  inferPitchCondition,
  competitionSuggestsRelegation,
  isNearBottomOfTable,
  isNearTopOfTable,
  type NarrativeMatchContext,
  type NarrativeSquadPlayer,
} from "./match-narrative-commentary";
import { findCatalogEntryForCompetitionName } from "./competition-catalog";
import { buildIntelligenceInPlayCommentary } from "./match-narrative-intelligence-engine";

function starter(name: string, jersey: number, playerId = name): NarrativeSquadPlayer {
  return { playerId, jerseyNumber: jersey, name, squadRole: "starting" };
}

const sampleTeamStats = {
  home: {
    tries: 2,
    conversions: 1,
    penalties: 0,
    dropGoals: 0,
    carries: 80,
    metres: 320,
    tackles: 90,
    turnoversWon: 4,
    possessionOverallPct: 48,
    possessionFirstHalfPct: 45,
    possessionSecondHalfPct: 51,
    territoryOverallPct: 44,
    territoryFirstHalfPct: 42,
    territorySecondHalfPct: 46,
    missedTackles: 18,
    tackleSuccessPct: 78,
    kicksFromHand: 20,
    kickingMetres: 450,
    kickingSuccessPct: null,
    rucksWon: 60,
    rucksLost: 2,
    totalRucks: 62,
    rucksSuccessPct: 97,
    scrumSuccessPct: 92,
    lineoutSuccessPct: 75,
  },
  away: {
    tries: 2,
    conversions: 2,
    penalties: 1,
    dropGoals: 0,
    carries: 95,
    metres: 400,
    tackles: 70,
    turnoversWon: 6,
    possessionOverallPct: 52,
    possessionFirstHalfPct: 55,
    possessionSecondHalfPct: 49,
    territoryOverallPct: 56,
    territoryFirstHalfPct: 58,
    territorySecondHalfPct: 54,
    missedTackles: 10,
    tackleSuccessPct: 85,
    kicksFromHand: 22,
    kickingMetres: 520,
    kickingSuccessPct: null,
    rucksWon: 55,
    rucksLost: 3,
    totalRucks: 58,
    rucksSuccessPct: 95,
    scrumSuccessPct: 88,
    lineoutSuccessPct: 55,
  },
};

const baseCtx: NarrativeMatchContext = {
  homeName: "Boland Cavaliers",
  awayName: "Pumas",
  competitionName: "Currie Cup",
  round: "Round 3",
  venueName: "Boland Stadium",
  refereeName: "Morne Ferreira",
  homeCoachName: "Kloppie Botha",
  awayCoachName: "Jimmy Stonehouse",
  homeSquad: [
    { jerseyNumber: 1, name: "Mthokozisi Gumede", squadRole: "starting" },
    { jerseyNumber: 10, name: "Chris Smit", squadRole: "starting" },
    { jerseyNumber: 16, name: "Darnell Osuagwu", squadRole: "substitute" },
  ],
  awaySquad: [
    { jerseyNumber: 10, name: "Nevaldo Fleurs", squadRole: "starting" },
    { jerseyNumber: 15, name: "Jay-Cee Nel", squadRole: "starting" },
  ],
  homeTable: {
    teamName: "Boland Cavaliers",
    rank: 3,
    points: 10,
    won: 2,
    drawn: 0,
    lost: 1,
  },
  awayTable: { teamName: "Pumas", rank: 6, points: 6, won: 1, drawn: 0, lost: 2 },
  tableSize: 8,
  suggestsRelegation: false,
  homeNextFixture: {
    teamName: "Boland Cavaliers",
    opponentName: "Griquas",
    isHome: false,
    kickoffAt: "2026-08-09T13:00:00.000Z",
    competitionName: "Currie Cup",
  },
  awayNextFixture: {
    teamName: "Pumas",
    opponentName: "Sharks",
    isHome: true,
    kickoffAt: "2026-08-08T15:00:00.000Z",
    competitionName: "Currie Cup",
  },
  manOfTheMatch: {
    playerName: "Nevaldo Fleurs",
    teamName: "Pumas",
    rating: 8.4,
    reasons: ["8.4 rating", "1 try", "12 points"],
  },
  weather: {
    conditionLabel: "Partly cloudy",
    temperatureC: 18,
    windSpeedKmh: 12,
    windCompass: "SW",
    precipitationMm: 0,
  },
  winPrediction: {
    favoriteName: "Boland Cavaliers",
    homePercent: 55,
    awayPercent: 42,
    drawPercent: 3,
  },
  headToHead: {
    totalMeetings: 1,
    homeWins: 1,
    awayWins: 0,
    draws: 0,
    recent: [
      {
        date: "2025-08-22T14:00:00.000Z",
        homeTeam: "Pumas",
        awayTeam: "Boland Cavaliers",
        homeScore: 26,
        awayScore: 29,
        competition: "Currie Cup",
      },
    ],
  },
  playerStatHighlights: [
    { playerName: "Nevaldo Fleurs", teamName: "Pumas", label: "points", value: 12 },
    { playerName: "Chris Smit", teamName: "Boland Cavaliers", label: "tackles", value: 12 },
    { playerName: "Llewelyn Classen", teamName: "Boland Cavaliers", label: "metres", value: 55 },
  ],
  teamStats: sampleTeamStats,
  events: [
    {
      minute: 7,
      eventType: "penalty_goal",
      teamName: "Pumas",
      playerName: "Nevaldo Fleurs",
      homeScore: 0,
      awayScore: 3,
    },
    {
      minute: 15,
      eventType: "substitution",
      teamName: "Boland Cavaliers",
      playerOn: "Johnre Stopforth",
      playerOff: "Marlyn Williams",
    },
    {
      minute: 25,
      eventType: "try",
      teamName: "Pumas",
      playerName: "Nevaldo Fleurs",
      homeScore: 0,
      awayScore: 8,
    },
    {
      minute: 40,
      eventType: "half_time",
      homeScore: 0,
      awayScore: 8,
    },
    {
      minute: 55,
      eventType: "try",
      teamName: "Boland Cavaliers",
      playerName: "Chris Smit",
      homeScore: 5,
      awayScore: 8,
    },
    {
      minute: 80,
      eventType: "full_time",
      homeScore: 12,
      awayScore: 17,
    },
  ],
  finalHomeScore: 12,
  finalAwayScore: 17,
  status: "full_time",
};

describe("match narrative commentary", () => {
  it("opens with stadium, competition, and teams", () => {
    expect(buildWelcomeLine(baseCtx).body).toBe(
      "Welcome to Boland Stadium. It's Currie Cup Round 3 between Boland Cavaliers and Pumas.",
    );
  });

  it("announces the referee", () => {
    expect(buildRefereeLine(baseCtx)?.body).toBe("The referee today is Morne Ferreira.");
  });

  it("includes a weather and pitch update", () => {
    expect(inferPitchCondition(baseCtx.weather!)).toContain("firm and dry");
    expect(buildWeatherPitchLine(baseCtx)?.body).toContain("Weather and pitch update at Boland Stadium");
    expect(buildWeatherPitchLine(baseCtx)?.body).toContain("18°C");
    expect(buildWeatherPitchLine(baseCtx)?.body).toContain("firm and dry");
  });

  it("flags a greasy pitch when rain is about", () => {
    expect(
      inferPitchCondition({ conditionLabel: "Rain", precipitationMm: 1.2 }),
    ).toContain("greasy");
  });

  it("includes table positions with top-of-table colour", () => {
    expect(isNearTopOfTable(3)).toBe(true);
    expect(buildTablePositionLine(baseCtx)?.body).toContain(
      "near the top of the Currie Cup table in 3rd",
    );
    expect(buildTablePositionLine(baseCtx)?.body).toContain("Pumas sit 6th");
    expect(buildTablePositionLine(baseCtx)?.body).toContain("W2 D0 L1");
  });

  it("adds summit contention and careful foot-of-table lines", () => {
    const lines = buildTableContentionLines(baseCtx);
    expect(lines.some((l) => l.segment === "table_top")).toBe(true);
    expect(lines.find((l) => l.segment === "table_top")?.body).toContain("Boland Cavaliers (3rd)");
    expect(isNearBottomOfTable(6, 8)).toBe(true);
    const bottom = lines.find((l) => l.segment === "table_bottom");
    expect(bottom?.body).toContain("sitting near the foot of the table");
    expect(bottom?.body).not.toMatch(/avoid the drop/i);
  });

  it("uses drop wording only when competition suggests relegation", () => {
    const lines = buildTableContentionLines({
      ...baseCtx,
      competitionName: "Top 14",
      suggestsRelegation: true,
      homeTable: { teamName: "Boland Cavaliers", rank: 13, points: 8 },
      awayTable: { teamName: "Pumas", rank: 14, points: 4 },
      tableSize: 14,
    });
    const bottom = lines.find((l) => l.segment === "table_bottom");
    expect(bottom?.body).toMatch(/avoid the drop|fighting at the bottom/i);
  });

  it("flags European league relegation pressure via catalog helper", () => {
    expect(competitionSuggestsRelegation(findCatalogEntryForCompetitionName("Currie Cup"))).toBe(
      false,
    );
    expect(competitionSuggestsRelegation(findCatalogEntryForCompetitionName("Top 14"))).toBe(true);
    expect(competitionSuggestsRelegation(findCatalogEntryForCompetitionName("Premiership"))).toBe(
      false,
    );
  });

  it("announces next fixtures and man of the match after full time", () => {
    const lines = buildMatchNarrativeCommentary(baseCtx);
    expect(lines.some((l) => l.segment === "next_fixture" && l.body.includes("Griquas"))).toBe(
      true,
    );
    expect(lines.some((l) => l.segment === "next_fixture" && l.body.includes("Sharks"))).toBe(
      true,
    );
    const motm = buildManOfTheMatchLine(baseCtx, 80);
    expect(motm?.body).toContain("Man of the Match is Nevaldo Fleurs");
    expect(motm?.body).toContain("8.4 rating");
    expect(lines.some((l) => l.segment === "man_of_the_match")).toBe(true);

    const nextLines = buildNextFixtureLines(baseCtx, 80);
    expect(nextLines[0]?.body).toContain("away against Griquas");
  });

  it("includes a Betting Intelligence tip", () => {
    expect(buildPredictionLine(baseCtx)?.body).toContain("Betting Intelligence tip");
    expect(buildPredictionLine(baseCtx)?.body).toContain("Boland Cavaliers");
    expect(buildPredictionLine(baseCtx)?.body).toContain("55%");
    expect(buildPredictionLine(baseCtx)?.segment).toBe("betting_intelligence_prematch");
  });

  it("announces home and away lineups with coaches", () => {
    const home = buildTeamAnnouncementLine(
      baseCtx.homeName,
      baseCtx.homeCoachName,
      baseCtx.homeSquad,
      "home",
    );
    expect(home?.body).toContain("managed by Kloppie Botha");
  });

  it("compares starting XV changes from the last game", () => {
    const previous = Array.from({ length: 15 }, (_, i) =>
      starter(i === 0 ? "Old Prop" : `Starter ${i + 1}`, i + 1),
    );
    const current = Array.from({ length: 15 }, (_, i) =>
      starter(i === 0 ? "New Prop" : `Starter ${i + 1}`, i + 1),
    );
    const changes = diffStartingLineup(current, previous);
    expect(changes).toEqual({ comingIn: ["New Prop"], droppingOut: ["Old Prop"] });
    expect(formatLineupChangesFromLastGame(changes, "Kloppie Botha")).toContain(
      "Changes by Kloppie Botha from last time: New Prop comes in for Old Prop.",
    );

    const announcement = buildTeamAnnouncementLine(
      "Boland Cavaliers",
      "Kloppie Botha",
      current,
      "home",
      previous,
    );
    expect(announcement?.body).toContain("comes in for Old Prop");
  });

  it("notes an unchanged XV from last time", () => {
    const xv = Array.from({ length: 15 }, (_, i) => starter(`Starter ${i + 1}`, i + 1));
    expect(formatLineupChangesFromLastGame(diffStartingLineup(xv, xv))).toContain(
      "Unchanged starting XV from last time",
    );
  });

  it("starts the match at 1'", () => {
    expect(buildKickOffLine(baseCtx).body).toContain("1' — And we're underway at Boland Stadium!");
  });

  it("keeps Generate pre-match only when the fixture is still scheduled with no events", () => {
    const scheduled: NarrativeMatchContext = {
      ...baseCtx,
      status: "scheduled",
      events: [],
      finalHomeScore: undefined,
      finalAwayScore: undefined,
      manOfTheMatch: null,
      teamStats: undefined,
      playerStatHighlights: [],
    };
    const lines = buildMatchNarrativeCommentary(scheduled);
    expect(lines.some((l) => l.segment === "kick_off")).toBe(false);
    expect(lines.some((l) => /underway|Half-time|10' —|25' —|60' —/i.test(l.body))).toBe(false);
    expect(buildIntelligenceInPlayCommentary(scheduled)).toEqual([]);
  });

  it("uses coach-named changes instead of substitutions", () => {
    const lines = buildMatchNarrativeCommentary(baseCtx);
    const change = lines.find((l) => l.segment === "coach_watch");
    expect(change?.body).toMatch(/Kloppie Botha/);
    expect(change?.body).not.toMatch(/substitut/i);
  });

  it("builds intelligence segments with tries, story, coach watch and blended insight", () => {
    const lines = buildMatchNarrativeCommentary(baseCtx);
    const segments = lines.map((l) => l.segment);
    expect(segments).toContain("weather_pitch");
    expect(segments).toContain("table_positions");
    expect(segments).toContain("betting_intelligence_prematch");
    expect(segments).toContain("head_to_head");
    expect(segments).toContain("play_by_play");
    expect(segments).toContain("match_story");
    expect(segments).toContain("coach_watch");
    expect(segments).toContain("journalist_insight");
    expect(segments).toContain("momentum");
    expect(lines.some((l) => l.body.includes("TRY! Nevaldo Fleurs"))).toBe(true);
    expect(lines.some((l) => /FULL-TIME/.test(l.body) && /Currie Cup/.test(l.body))).toBe(true);
    expect(lines.some((l) => /Half-time/.test(l.body))).toBe(true);
  });

  it("never emits raw Territory update or Opta possession dumps", () => {
    const lines = buildMatchNarrativeCommentary(baseCtx);
    for (const l of lines) {
      expect(l.body).not.toMatch(/Territory update:/i);
      expect(l.body).not.toMatch(/^Possession\s+\d+%/i);
      expect(l.body).not.toMatch(/Possession update:/i);
    }
  });

  it("does not flood every minute with filler", () => {
    const inPlay = buildIntelligenceInPlayCommentary(baseCtx);
    const covered = new Set(inPlay.map((l) => l.minute));
    // Cadence should publish story + events + periodic insights — not 80 Opta pads.
    expect(covered.size).toBeLessThan(55);
    expect(covered.size).toBeGreaterThan(10);
  });

  it("FT is a narrative report not a bare score", () => {
    const lines = buildMatchNarrativeCommentary(baseCtx);
    const ft = lines.find((l) => l.body.startsWith("FULL-TIME"));
    expect(ft?.segment).toBe("match_story");
    expect(ft?.body.length ?? 0).toBeGreaterThan(60);
    expect(ft?.body).not.toMatch(/^FULL-TIME — Boland Cavaliers 12–17 Pumas\.$/);
  });
});
