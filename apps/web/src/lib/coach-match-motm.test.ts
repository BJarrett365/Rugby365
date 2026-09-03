import { describe, expect, it } from "vitest";
import { matchClusterKey, normalizeMatchTeamName, utcDayKey } from "./coach-match-motm";

describe("matchClusterKey", () => {
  it("clusters duplicate team copies on the same day", () => {
    const kickoff = new Date("2025-11-22T17:40:00.000Z");
    expect(
      matchClusterKey({
        kickoffAt: kickoff,
        homeTeamName: "Ireland",
        awayTeamName: "South Africa",
        homeScore: 13,
        awayScore: 24,
      }),
    ).toBe(
      matchClusterKey({
        kickoffAt: kickoff,
        homeTeamName: "Ireland",
        awayTeamName: "South Africa",
        homeScore: 13,
        awayScore: 24,
      }),
    );
  });

  it("uses scores when team names are missing", () => {
    expect(
      matchClusterKey({
        kickoffAt: "2026-07-11T15:40:00.000Z",
        homeScore: 42,
        awayScore: 28,
      }),
    ).toBe("2026-07-11|s|42-28");
  });

  it("falls back to scores when one team name is unknown", () => {
    expect(
      matchClusterKey({
        kickoffAt: "2026-07-04T15:40:00.000Z",
        homeTeamName: "South Africa",
        awayTeamName: "Unknown team 1c90fe006596",
        homeScore: 45,
        awayScore: 21,
      }),
    ).toBe("2026-07-04|s|45-21");
  });

  it("normalizes unknown team labels away from the name key", () => {
    expect(normalizeMatchTeamName("Unknown team 1c90fe006596")).toBe("");
    expect(utcDayKey(new Date("2026-08-22T15:10:00.000Z"))).toBe("2026-08-22");
  });
});
