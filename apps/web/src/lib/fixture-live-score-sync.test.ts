import { describe, expect, it } from "vitest";
import { resolveLiveScoreSyncPatch } from "./fixture-live-score-sync";
import type { SdmsMatchDetail } from "@rugby365/import-sdk";

function detail(partial: Partial<SdmsMatchDetail>): SdmsMatchDetail {
  return {
    match_id: "m1",
    date: "2026-08-02",
    time: "14:00",
    status: "First Half",
    competition_name: "Currie Cup",
    home_team_name: "Boland Cavaliers",
    home_team_slug: "boland-cavaliers",
    home_team_score: 5,
    away_team_name: "Pumas",
    away_team_slug: "pumas",
    away_team_score: 3,
    minutes: 28,
    seconds: 12,
    ...partial,
  };
}

const existing = {
  homeScore: 0,
  awayScore: 3,
  status: "live",
  matchMinute: 0,
  matchSecond: 0,
  period: "not_started",
};

describe("resolveLiveScoreSyncPatch", () => {
  it("updates stale CMS scores and clock from SDMS", () => {
    expect(resolveLiveScoreSyncPatch(detail({}), existing)).toEqual({
      homeScore: 5,
      matchMinute: 28,
      matchSecond: 12,
      period: "first_half",
    });
  });

  it("does not wipe CMS scores with blank SDMS 0-0 when fixture is not live", () => {
    expect(
      resolveLiveScoreSyncPatch(
        detail({
          status: "Fixture",
          home_team_score: 0,
          away_team_score: 0,
          minutes: undefined,
          seconds: undefined,
        }),
        { ...existing, homeScore: 17, awayScore: 10, status: "scheduled" },
      ),
    ).toEqual({});
  });

  it("does not wipe CMS scores with live SDMS 0-0", () => {
    const patch = resolveLiveScoreSyncPatch(
      detail({ home_team_score: 0, away_team_score: 0, minutes: 12 }),
      { ...existing, homeScore: 5, awayScore: 3 },
    );
    expect(patch.homeScore).toBeUndefined();
    expect(patch.awayScore).toBeUndefined();
    expect(patch.matchMinute).toBe(12);
  });

  it("does not regress match minute to zero during live play", () => {
    const patch = resolveLiveScoreSyncPatch(
      detail({ minutes: 0, seconds: 0, status: "Second Half" }),
      { ...existing, homeScore: 5, awayScore: 10, matchMinute: 50, period: "second_half" },
    );
    expect(patch.matchMinute).toBeUndefined();
    expect(patch.period).toBeUndefined();
  });

  it("maps Halftime zero minutes to 40", () => {
    const patch = resolveLiveScoreSyncPatch(
      detail({ minutes: 0, seconds: 0, status: "Halftime" }),
      { ...existing, matchMinute: 39, period: "first_half" },
    );
    expect(patch.matchMinute).toBe(40);
    expect(patch.period).toBe("half_time");
  });

  it("respects locked score fields", () => {
    expect(
      resolveLiveScoreSyncPatch(detail({}), existing, new Set(["homeScore"])),
    ).toEqual({
      matchMinute: 28,
      matchSecond: 12,
      period: "first_half",
    });
  });
});
