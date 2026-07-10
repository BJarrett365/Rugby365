import { describe, expect, it } from "vitest";
import { diffBioSections } from "./player-bio-automation-service";
import { inferPrimaryBioType, parseBioSections, buildBioPrompt } from "./player-bio-prompt-service";
import type { PlayerBioPacket, PlayerBioSections } from "./player-bio-types";
import {
  ageProfileForAge,
  buildPlayerRatingSnapshot,
  buildRatingExplanation,
  shouldTriggerBioRefresh,
} from "./player-rating-service";
import type { PlayerMatchStatsRow, PlayerSeasonStatsRow } from "./player-season-stats-service";

const baseSeason: PlayerSeasonStatsRow = {
  id: "season-1",
  playerId: "player-1",
  seasonId: "s1",
  seasonLabel: "2025/26",
  competitionId: "c1",
  competitionName: "Premiership Rugby",
  teamId: "team-1",
  teamName: "Newcastle Falcons",
  appearances: 10,
  minutesPlayed: 700,
  tries: 2,
  points: 10,
  carries: 40,
  metresCarried: 220,
  tacklesMade: 80,
  tacklesCompleted: 72,
  dominantTackles: 8,
  turnoversWon: 3,
  tryAssists: 1,
  lineBreaks: 4,
  defendersBeaten: 6,
  touches: 90,
  postContactMetres: 50,
  ruckArrivalEffectiveness: 12,
  attackRank: 3,
  defenceRank: 2,
  carriesPerMinute: 0.05,
  tacklesPerMinute: 0.1,
  averages: {} as PlayerSeasonStatsRow["averages"],
};

const baseMatch: PlayerMatchStatsRow = {
  ...baseSeason,
  fixtureId: "fix-1",
  fixtureSlug: "newcastle-bath",
  kickoffAt: "2026-03-01T15:00:00.000Z",
  playerName: "Adam Brocklebank",
  opponentName: "Bath",
  syncedAt: "2026-03-02T00:00:00.000Z",
};

const packet: PlayerBioPacket = {
  playerId: "player-1",
  name: "Adam Brocklebank",
  fullName: "Adam Brocklebank",
  birthDate: "1998-04-12",
  age: 28,
  nationality: "England",
  nationCode: "ENG",
  heightCm: 183,
  weightKg: 118,
  position: "Loosehead Prop",
  currentClub: "Newcastle Falcons",
  internationalTeam: null,
  isInternational: false,
  previousClubs: ["Bedford Blues"],
  transferHistory: [],
  careerStints: [],
  recentMatches: [],
  seasonStats: [],
  scoringStats: { tries: 2, conversions: 0, penalties: 0, dropGoals: 0, points: 10 },
  rating: buildPlayerRatingSnapshot({
    playerId: "player-1",
    birthDate: "1998-04-12",
    internationalTeamId: null,
    seasonStats: [baseSeason],
    matchStats: [baseMatch],
    fixtureCount: 10,
    hasLegend: false,
  }),
  legends: [],
  availability: {
    currentStatus: "Available",
    isUnavailable: false,
    unavailableReason: null,
    returningPlayer: false,
    totalMatchesMissed: 0,
    expectedReturnDate: null,
    currentInjuryType: null,
    currentSuspensionOffence: null,
    injuryHistoryCount: 0,
    suspensionHistoryCount: 0,
  },
  sourceUrls: [{ label: "RugbyPass", url: "https://www.rugbypass.com/players/adam-brocklebank/" }],
  confidenceScore: 0.72,
  missingFields: [],
  conflicts: [],
  generatedAt: "2026-07-06T00:00:00.000Z",
};

describe("player bio prompt generation", () => {
  it("builds domestic bio prompt from verified packet", () => {
    const prompt = buildBioPrompt("domestic", packet);
    expect(prompt.system).toContain("NOT the source of truth");
    expect(prompt.user).toContain("Adam Brocklebank");
    expect(prompt.promptVersion).toBe("player-bio-v1");
  });

  it("parses structured bio sections", () => {
    const sections = parseBioSections({
      shortIntro: "Adam Brocklebank is an English loosehead prop.",
      fullBio: "Full profile.",
      playingStyle: "Powerful scrummager.",
    });
    expect(sections.shortIntro).toContain("Adam Brocklebank");
    expect(sections.fullBio).toBe("Full profile.");
  });

  it("infers international bio type when player is capped", () => {
    expect(inferPrimaryBioType({ ...packet, isInternational: true })).toBe("international");
    expect(inferPrimaryBioType(packet)).toBe("domestic");
  });
});

describe("player rating packet integration", () => {
  it("includes rating data in bio packet shape", () => {
    expect(packet.rating.displayRating).not.toBeNull();
    expect(packet.rating.ratingExplanation).toContain("Rugby365 Player Rating");
  });

  it("handles low-confidence ratings in explanation text", () => {
    const lowConfidence = buildRatingExplanation({
      displayRating: 68,
      calculatedRating: 68,
      formScore: 66,
      formMovement: null,
      attackRating: 70,
      defenceRating: 65,
      teamImportance: 60,
      ratingConfidence: 0.3,
      manualOverrideRating: null,
      lastFiveMatchRatings: [],
      badges: [],
    });
    expect(lowConfidence).toContain("limited verified match data");
  });

  it("uses manual override in explanation while keeping calculated rating visible", () => {
    const explanation = buildRatingExplanation({
      displayRating: 82,
      calculatedRating: 76,
      formScore: 78,
      formMovement: 6,
      attackRating: 80,
      defenceRating: 74,
      teamImportance: 77,
      ratingConfidence: 0.7,
      manualOverrideRating: 82,
      lastFiveMatchRatings: [74, 76, 78, 80, 82],
      badges: [{ key: "rising_star", label: "Rising Star", description: "" }],
    });
    expect(explanation).toContain("editor-overridden");
    expect(explanation).toContain("calculated rating is 76");
  });

  it("maps age to profile bands", () => {
    expect(ageProfileForAge(19)).toBe("development");
    expect(ageProfileForAge(28)).toBe("prime");
    expect(ageProfileForAge(33)).toBe("veteran");
  });
});

describe("bio refresh trigger logic", () => {
  it("triggers when form rating increases materially", () => {
    const previous = {
      rating: { ...packet.rating, formScore: 60, displayRating: 70, badges: [] },
      currentClub: "Newcastle Falcons",
      position: "Loosehead Prop",
      isInternational: false,
    };
    const next = {
      rating: { ...packet.rating, formScore: 70, displayRating: 70, badges: [] },
      currentClub: "Newcastle Falcons",
      position: "Loosehead Prop",
      isInternational: false,
    };
    const result = shouldTriggerBioRefresh({
      previousPacket: previous,
      nextPacket: next,
      trigger: "match_stats_imported",
    });
    expect(result.shouldRefresh).toBe(true);
    expect(result.reason).toContain("Form Rating");
  });

  it("triggers when a new badge is added", () => {
    const previous = {
      rating: { ...packet.rating, badges: [] },
      currentClub: packet.currentClub,
      position: packet.position,
      isInternational: false,
    };
    const next = {
      rating: {
        ...packet.rating,
        badges: [{ key: "rising_star", label: "Rising Star", description: "Rising" }],
      },
      currentClub: packet.currentClub,
      position: packet.position,
      isInternational: false,
    };
    const result = shouldTriggerBioRefresh({
      previousPacket: previous,
      nextPacket: next,
      trigger: "rating_changed",
    });
    expect(result.shouldRefresh).toBe(true);
    expect(result.reason).toContain("Rising Star");
  });
});

describe("bio approval flow helpers", () => {
  it("diffs section changes since last approved bio", () => {
    const current: PlayerBioSections = {
      shortIntro: "Old intro",
      fullBio: "",
      playingStyle: "",
      strengths: "",
      areasToImprove: "",
      careerSummary: "",
      internationalSummary: "",
      currentSeasonSummary: "",
      scoutingSummary: "",
      ratingExplanation: "",
      legendSummary: "",
    };
    const suggested: PlayerBioSections = {
      ...current,
      shortIntro: "New intro",
      playingStyle: "Set-piece focused.",
    };
    const changes = diffBioSections(current, suggested);
    expect(changes.map((change) => change.section)).toEqual(["shortIntro", "playingStyle"]);
  });
});

describe("rating movement text", () => {
  it("describes rating movement from stored match ratings", () => {
    const explanation = buildRatingExplanation({
      displayRating: 81,
      calculatedRating: 81,
      formScore: 80,
      formMovement: 7,
      attackRating: 82,
      defenceRating: 78,
      teamImportance: 76,
      ratingConfidence: 0.8,
      manualOverrideRating: null,
      lastFiveMatchRatings: [81, 79, 78, 76, 74],
      badges: [],
    });
    expect(explanation).toContain("risen from 74 to 81");
  });
});
