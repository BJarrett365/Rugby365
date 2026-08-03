import { describe, expect, it } from "vitest";
import { evaluatePregameReadiness, isPregameStatus } from "./match-pregame-readiness";
import { collectMatchWarnings, classifyTodayBucket } from "./match-cms-warnings";

describe("pre-game readiness", () => {
  it("requires stadium, weather coords, referee and both coaches", () => {
    const result = evaluatePregameReadiness({
      venueId: null,
      venueHasCoords: false,
      refereeId: null,
      homeCoachId: null,
      awayCoachId: null,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual([
      "stadium",
      "weather",
      "referee",
      "home_coach",
      "away_coach",
    ]);
  });

  it("is ready when all five checks pass", () => {
    const result = evaluatePregameReadiness({
      venueId: "v1",
      venueHasCoords: true,
      refereeId: "r1",
      homeCoachId: "c1",
      awayCoachId: "c2",
    });
    expect(result.ready).toBe(true);
    expect(result.readyCount).toBe(5);
  });

  it("flags weather when stadium exists without coordinates", () => {
    const result = evaluatePregameReadiness({
      venueId: "v1",
      venueHasCoords: false,
      refereeId: "r1",
      homeCoachId: "c1",
      awayCoachId: "c2",
    });
    expect(result.missing).toEqual(["weather"]);
  });

  it("surfaces pre-game coach/weather warnings on scheduled matches", () => {
    const warnings = collectMatchWarnings({
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: "v",
      refereeId: "r",
      homeCoachId: null,
      awayCoachId: null,
      venueHasCoords: false,
      hasLineups: true,
      hasTeamStats: true,
      hasPlayerStats: true,
      primaryApiMatchId: "1",
      status: "scheduled",
    });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("home_coach");
    expect(codes).toContain("away_coach");
    expect(codes).toContain("weather");
    expect(isPregameStatus("scheduled")).toBe(true);
  });

  it("classifies pregame_not_ready ops bucket", () => {
    const buckets = classifyTodayBucket({
      id: "1",
      kickoffAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: "v",
      refereeId: null,
      homeCoachId: null,
      awayCoachId: "c2",
      venueHasCoords: true,
      hasLineups: true,
      hasTeamStats: true,
      hasPlayerStats: true,
      primaryApiMatchId: "1",
      warningCount: 2,
    });
    expect(buckets).toContain("pregame_not_ready");
    expect(buckets).toContain("missing_referee");
    expect(buckets).toContain("missing_coach");
  });
});
