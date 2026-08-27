import { describe, expect, it } from "vitest";
import {
  buildCareerMilestones,
  buildPublicPlayerCareerV2,
  competitionBucketLabel,
  displayClubName,
  type CareerMatchInput,
} from "./public-player-career-v2-math";

function match(partial: Partial<CareerMatchInput> & Pick<CareerMatchInput, "fixtureId" | "teamName">): CareerMatchInput {
  return {
    kickoffAt: new Date("2024-03-01T15:00:00Z"),
    status: "completed",
    seasonStart: 2023,
    seasonLabel: "2023–24",
    competitionName: "United Rugby Championship",
    competitionType: "club",
    teamId: "t1",
    opponentName: "Bulls",
    opponentCountryName: "South Africa",
    result: "W",
    positionName: "fly-half",
    jerseyNumber: 10,
    squadRole: "starting",
    tries: 0,
    conversions: 0,
    penalties: 0,
    dropGoals: 0,
    points: 0,
    minutes: 80,
    assists: 0,
    cleanBreaks: 0,
    defendersBeaten: 0,
    tacklesMade: 5,
    passes: 20,
    badPasses: 2,
    conversionAttempts: null,
    penaltyAttempts: null,
    dropGoalAttempts: null,
    isInternational: false,
    hasPerf: true,
    ...partial,
  };
}

describe("public-player-career-v2-math", () => {
  it("displayClubName strips roman squad suffixes", () => {
    expect(displayClubName("DHL Stormers XXIII")).toBe("DHL Stormers");
  });

  it("displayClubName blanks unknown orphan labels", () => {
    expect(displayClubName("Unknown team d447c40cded2")).toBe("Unknown club");
  });

  it("competitionBucketLabel collapses URC and tests", () => {
    expect(competitionBucketLabel("United Rugby Championship", "club", false)).toBe("URC");
    expect(competitionBucketLabel("Autumn Nations Series", "international", true)).toBe(
      "Test Matches",
    );
    expect(competitionBucketLabel("Rugby World Cup", "world_cup", true)).toBe("Rugby World Cup");
  });

  it("builds career totals and timeline from matches", () => {
    const dto = buildPublicPlayerCareerV2({
      playerId: "p1",
      matches: [
        match({
          fixtureId: "1",
          teamName: "DHL Stormers",
          kickoffAt: new Date("2023-09-01T15:00:00Z"),
          points: 12,
          tries: 1,
          conversions: 2,
          penalties: 1,
          defendersBeaten: 3,
          cleanBreaks: 1,
          assists: 1,
        }),
        match({
          fixtureId: "2",
          teamName: "South Africa",
          kickoffAt: new Date("2024-07-01T15:00:00Z"),
          seasonStart: 2024,
          seasonLabel: "2024",
          competitionName: "Test Match",
          competitionType: "international",
          isInternational: true,
          points: 5,
          tries: 1,
          opponentName: "Wales",
          opponentCountryName: "Wales",
        }),
      ],
      stints: [],
      achievements: [{ id: "a1", year: 2024, title: "Player of the Month", detail: null, verificationStatus: "verified" }],
      verifiedCaps: 15,
      internationalTeamName: "Springboks",
      dataAsOfIso: "2025-05-12T00:00:00Z",
    });

    expect(dto.totals.find((t) => t.key === "played")?.value).toBe(2);
    expect(dto.totals.find((t) => t.key === "points")?.value).toBe(17);
    expect(dto.meta.internationalCaps).toBe(15);
    expect(dto.meta.clubCount).toBe(1);
    expect(dto.timeline).toHaveLength(2);
    expect(dto.pointsByCompetition[0]?.label).toBe("URC");
    expect(dto.clubSeasonRows).toHaveLength(1);
    expect(dto.internationalSeasonRows).toHaveLength(1);
    expect(dto.awards).toHaveLength(1);
    expect(dto.positions.slices[0]?.positionName).toBe("Fly-Half");
  });

  it("builds debut milestones", () => {
    const milestones = buildCareerMilestones(
      [
        match({
          fixtureId: "1",
          teamName: "Stormers",
          kickoffAt: new Date("2021-06-19T15:00:00Z"),
          opponentName: "Bulls",
        }),
        match({
          fixtureId: "2",
          teamName: "South Africa",
          kickoffAt: new Date("2023-08-02T15:00:00Z"),
          isInternational: true,
          opponentName: "Wales",
          competitionName: "Test",
          competitionType: "international",
        }),
      ],
      [],
    );
    expect(milestones.some((m) => m.id === "pro-debut")).toBe(true);
    expect(milestones.some((m) => m.id === "intl-debut")).toBe(true);
  });
});
