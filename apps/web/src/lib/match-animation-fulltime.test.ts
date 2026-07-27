import { describe, expect, it } from "vitest";
import {
  defaultAnimationViewAfterLoad,
  fullTimeAnnouncement,
  fullTimeHeadline,
  fullTimeHoldMs,
  isFullTimeConfirmed,
  officialFinalScore,
  resolveMatchResultKind,
  showsFullTimeLabel,
} from "./match-animation-fulltime";

describe("isFullTimeConfirmed", () => {
  it("requires CMS status or approved FT event — not clock alone", () => {
    expect(
      isFullTimeConfirmed({
        fixtureStatus: "live",
        period: "second_half",
      }),
    ).toBe(false);
    expect(
      isFullTimeConfirmed({
        fixtureStatus: "result",
      }),
    ).toBe(true);
    expect(
      isFullTimeConfirmed({
        fixtureStatus: "live",
        fullTimeConfirmedAt: "2026-07-26T17:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isFullTimeConfirmed({
        fixtureStatus: "live",
        hasFullTimeEvent: true,
      }),
    ).toBe(true);
  });
});

describe("officialFinalScore", () => {
  it("prefers CMS fixture scores over fallback", () => {
    expect(
      officialFinalScore({
        cmsHomeScore: 56,
        cmsAwayScore: 26,
        fallbackHomeScore: 0,
        fallbackAwayScore: 0,
      }),
    ).toEqual({ home: 56, away: 26, source: "cms" });
  });

  it("uses fallback when CMS scores missing", () => {
    expect(
      officialFinalScore({
        cmsHomeScore: null,
        cmsAwayScore: null,
        fallbackHomeScore: 12,
        fallbackAwayScore: 10,
      }),
    ).toEqual({ home: 12, away: 10, source: "fallback" });
  });

  it("picks up corrected CMS scores", () => {
    const corrected = officialFinalScore({
      cmsHomeScore: 57,
      cmsAwayScore: 26,
      fallbackHomeScore: 56,
      fallbackAwayScore: 26,
    });
    expect(corrected).toEqual({ home: 57, away: 26, source: "cms" });
  });
});

describe("resolveMatchResultKind / headlines", () => {
  it("home win, away win, draw", () => {
    expect(resolveMatchResultKind({ fixtureStatus: "result", homeScore: 56, awayScore: 26 })).toBe(
      "home_win",
    );
    expect(resolveMatchResultKind({ fixtureStatus: "result", homeScore: 10, awayScore: 20 })).toBe(
      "away_win",
    );
    expect(resolveMatchResultKind({ fixtureStatus: "result", homeScore: 15, awayScore: 15 })).toBe(
      "draw",
    );
    expect(showsFullTimeLabel("home_win")).toBe(true);
    expect(fullTimeHeadline("home_win")).toBe("FULL-TIME");
  });

  it("extra time, abandoned, awarded, cancelled", () => {
    expect(
      resolveMatchResultKind({
        fixtureStatus: "result",
        homeScore: 22,
        awayScore: 19,
        extraTime: true,
      }),
    ).toBe("extra_time");
    expect(fullTimeHeadline("extra_time")).toBe("EXTRA TIME");
    expect(resolveMatchResultKind({ fixtureStatus: "abandoned", homeScore: 14, awayScore: 7 })).toBe(
      "abandoned",
    );
    expect(fullTimeHeadline("abandoned")).toBe("MATCH ABANDONED");
    expect(resolveMatchResultKind({ fixtureStatus: "awarded", homeScore: 0, awayScore: 0 })).toBe(
      "awarded",
    );
    expect(fullTimeHeadline("awarded")).toBe("RESULT AWARDED");
    expect(resolveMatchResultKind({ fixtureStatus: "cancelled", homeScore: 0, awayScore: 0 })).toBe(
      "cancelled",
    );
  });
});

describe("accessibility + default view", () => {
  it("announces full-time with scores", () => {
    expect(
      fullTimeAnnouncement({
        homeName: "Griquas",
        awayName: "Bulls",
        homeScore: 56,
        awayScore: 26,
        kind: "home_win",
      }),
    ).toBe("Full-time: Griquas 56, Bulls 26.");
  });

  it("opens full-time screen after FT without auto-replay", () => {
    expect(
      defaultAnimationViewAfterLoad({
        fullTimeConfirmed: true,
        hasDeepLinkEvent: false,
        showReplayControls: true,
      }),
    ).toBe("full_time");
    expect(
      defaultAnimationViewAfterLoad({
        fullTimeConfirmed: true,
        hasDeepLinkEvent: true,
        showReplayControls: true,
      }),
    ).toBe("replay");
  });

  it("holds result longer at 5× and 10×; reduced-motion skips hold", () => {
    expect(fullTimeHoldMs(1, false)).toBeLessThan(fullTimeHoldMs(5, false));
    expect(fullTimeHoldMs(10, false)).toBeGreaterThanOrEqual(fullTimeHoldMs(5, false));
    expect(fullTimeHoldMs(10, true)).toBe(0);
  });
});
