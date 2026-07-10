import { describe, expect, it } from "vitest";
import type { PlayerRatingSnapshot } from "./player-bio-types";
import {
  applyAvailabilityToRatingSnapshot,
  buildPlayerAvailabilityContext,
  filterMatchesForAvailabilityForm,
} from "./player-availability-intelligence";
import { buildPlayerRatingSnapshot } from "./player-rating-service";
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

const makeMatch = (fixtureId: string): PlayerMatchStatsRow => ({
  ...baseSeason,
  fixtureId,
  fixtureSlug: fixtureId,
  kickoffAt: "2026-03-01T15:00:00.000Z",
  playerName: "Test Player",
  opponentName: "Bath",
  syncedAt: "2026-03-02T00:00:00.000Z",
});

describe("buildPlayerAvailabilityContext", () => {
  it("prioritises suspension unavailability over doubtful injury", () => {
    const context = buildPlayerAvailabilityContext({
      injuries: [
        {
          id: "inj-1",
          status: "doubtful",
          injuryType: "Hamstring",
          bodyArea: "Leg",
          injuryDate: "2026-01-01",
          expectedReturnDate: "2026-02-01",
          actualReturnDate: null,
          matchesMissed: 1,
        },
      ],
      suspensions: [
        {
          id: "sus-1",
          status: "serving_suspension",
          offence: "Dangerous tackle",
          cardType: "red",
          fixtureId: "fix-red",
          suspensionStart: "2026-02-01",
          suspensionEnd: "2026-03-01",
          matchesRemaining: 2,
        },
      ],
    });

    expect(context.isUnavailable).toBe(true);
    expect(context.unavailableReason).toContain("Suspended");
    expect(context.excludedFormFixtureIds).toEqual(["fix-red"]);
    expect(context.totalMatchesMissed).toBe(1);
  });

  it("flags returning players after rehabilitation", () => {
    const context = buildPlayerAvailabilityContext({
      injuries: [
        {
          id: "inj-1",
          status: "return_to_training",
          injuryType: "Knee",
          bodyArea: "Leg",
          injuryDate: "2025-10-01",
          expectedReturnDate: "2026-03-15",
          actualReturnDate: null,
          matchesMissed: 8,
        },
      ],
      suspensions: [],
    });

    expect(context.returningPlayer).toBe(true);
    expect(context.isUnavailable).toBe(false);
  });
});

describe("applyAvailabilityToRatingSnapshot", () => {
  const baseSnapshot: PlayerRatingSnapshot = buildPlayerRatingSnapshot({
    playerId: "player-1",
    birthDate: "1998-04-12",
    internationalTeamId: null,
    seasonStats: [baseSeason],
    matchStats: [makeMatch("fix-1"), makeMatch("fix-2")],
    fixtureCount: 2,
    hasLegend: false,
    previous: null,
    manualOverrideRating: null,
    manualOverrideReason: null,
  });

  it("does not reduce current ability for injury", () => {
    const context = buildPlayerAvailabilityContext({
      injuries: [
        {
          id: "inj-1",
          status: "injured",
          injuryType: "Shoulder",
          bodyArea: "Upper body",
          injuryDate: "2025-11-01",
          expectedReturnDate: "2026-04-01",
          actualReturnDate: null,
          matchesMissed: 6,
        },
      ],
      suspensions: [],
    });

    const adjusted = applyAvailabilityToRatingSnapshot(baseSnapshot, context);
    expect(adjusted.currentAbility).toBe(baseSnapshot.currentAbility);
    expect(adjusted.ratingExplanation).toContain("Current Ability is not reduced");
  });

  it("adds returning player badge and reduces form confidence after long absence", () => {
    const context = buildPlayerAvailabilityContext({
      injuries: [
        {
          id: "inj-1",
          status: "in_rehabilitation",
          injuryType: "ACL",
          bodyArea: "Knee",
          injuryDate: "2025-01-01",
          expectedReturnDate: "2026-05-01",
          actualReturnDate: "2026-03-01",
          matchesMissed: 12,
        },
      ],
      suspensions: [],
    });

    const adjusted = applyAvailabilityToRatingSnapshot(
      { ...baseSnapshot, teamImportance: 82 },
      { ...context, returningPlayer: true, longAbsenceDays: 60 },
    );

    expect(adjusted.badges.some((badge) => badge.key === "returning_player")).toBe(true);
    expect(adjusted.badges.some((badge) => badge.key === "unavailable_key_player")).toBe(true);
    expect(adjusted.ratingConfidence).toBeLessThan(baseSnapshot.ratingConfidence ?? 1);
    expect(adjusted.ratingExplanation).toContain("long public absence");
  });

  it("excludes linked red-card fixture from form matches", () => {
    const matches = [makeMatch("fix-red"), makeMatch("fix-2"), makeMatch("fix-3")];
    const filtered = filterMatchesForAvailabilityForm(matches, ["fix-red"]);
    expect(filtered.map((row) => row.fixtureId)).toEqual(["fix-2", "fix-3"]);
  });
});
