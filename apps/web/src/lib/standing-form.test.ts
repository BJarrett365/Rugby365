import { describe, expect, it } from "vitest";
import {
  computeFormSequenceFromFixtures,
  normalizeFormSequence,
  padFormForDisplay,
  parseStandingForm,
  standingFormNeedsRecompute,
} from "./standing-form";

describe("normalizeFormSequence", () => {
  it("keeps plain sequences", () => {
    expect(normalizeFormSequence("WWWWL")).toBe("WWWWL");
  });

  it("uppercases and strips whitespace separators", () => {
    expect(normalizeFormSequence("w w l d")).toBe("WWLD");
  });

  it("strips all dash placeholders (including interior)", () => {
    expect(normalizeFormSequence("-WWWW")).toBe("WWWW");
    expect(normalizeFormSequence("LL-WW")).toBe("LLWW");
    expect(normalizeFormSequence("L-LL")).toBe("LLL");
    expect(normalizeFormSequence("--W")).toBe("W");
    expect(normalizeFormSequence("LLL--")).toBe("LLL");
  });

  it("rejects non-form text", () => {
    expect(normalizeFormSequence("Won 4 of 5")).toBeNull();
    expect(normalizeFormSequence("-----")).toBeNull();
    expect(normalizeFormSequence("")).toBeNull();
    expect(normalizeFormSequence(null)).toBeNull();
  });

  it("keeps only the most recent five results", () => {
    expect(normalizeFormSequence("WWWWWWWWWWWL")).toBe("WWWWL");
  });
});

describe("padFormForDisplay", () => {
  it("left-pads shorter sequences to five slots", () => {
    expect(padFormForDisplay("WWWL")).toBe("-WWWL");
    expect(padFormForDisplay("LL")).toBe("---LL");
    expect(padFormForDisplay("L-LL")).toBe("--LLL");
    expect(padFormForDisplay("WWWWL")).toBe("WWWWL");
    expect(padFormForDisplay(null)).toBe("-----");
  });
});

describe("parseStandingForm", () => {
  it("parses legacy SDMS JSON blobs", () => {
    expect(parseStandingForm('{"tbp":3,"lbp":1,"lf":"WWWWL"}')).toEqual({
      lastFive: "WWWWL",
      tryBonusPoints: 3,
      losingBonusPoints: 1,
    });
  });

  it("handles JSON blobs without a form sequence", () => {
    expect(parseStandingForm('{"tbp":0,"lbp":0,"lf":null}')).toEqual({
      lastFive: null,
      tryBonusPoints: 0,
      losingBonusPoints: 0,
    });
  });

  it("falls back to null on malformed JSON", () => {
    expect(parseStandingForm('{"tbp":')).toEqual({
      lastFive: null,
      tryBonusPoints: null,
      losingBonusPoints: null,
    });
  });

  it("parses plain sequences and strips dashes", () => {
    expect(parseStandingForm("LWWD")).toEqual({
      lastFive: "LWWD",
      tryBonusPoints: null,
      losingBonusPoints: null,
    });
    expect(parseStandingForm("L-LL")).toEqual({
      lastFive: "LLL",
      tryBonusPoints: null,
      losingBonusPoints: null,
    });
  });

  it("returns empty meta for blank values", () => {
    expect(parseStandingForm(null).lastFive).toBeNull();
    expect(parseStandingForm("   ").lastFive).toBeNull();
  });
});

describe("computeFormSequenceFromFixtures", () => {
  it("builds oldest-to-newest W/D/L from finished matches", () => {
    const teamId = "t1";
    const form = computeFormSequenceFromFixtures(teamId, [
      {
        teamId,
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeScore: 10,
        awayScore: 20,
        kickoffAt: "2025-01-01",
      },
      {
        teamId,
        homeTeamId: "t2",
        awayTeamId: "t1",
        homeScore: 7,
        awayScore: 14,
        kickoffAt: "2025-01-08",
      },
      {
        teamId,
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeScore: 15,
        awayScore: 15,
        kickoffAt: "2025-01-15",
      },
    ]);
    expect(form).toBe("LWD");
  });

  it("ignores 0-0 placeholder results", () => {
    const teamId = "t1";
    const form = computeFormSequenceFromFixtures(teamId, [
      {
        teamId,
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeScore: 0,
        awayScore: 0,
        kickoffAt: "2025-01-01",
      },
      {
        teamId,
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeScore: 21,
        awayScore: 10,
        kickoffAt: "2025-01-08",
      },
    ]);
    expect(form).toBe("W");
  });
});

describe("standingFormNeedsRecompute", () => {
  it("flags empty and dash-containing feed values", () => {
    expect(standingFormNeedsRecompute(null)).toBe(true);
    expect(standingFormNeedsRecompute("--W")).toBe(true);
    expect(standingFormNeedsRecompute("W-LWL")).toBe(true);
    expect(standingFormNeedsRecompute("WWWL")).toBe(false);
    expect(standingFormNeedsRecompute("WWWWL")).toBe(false);
  });
});
