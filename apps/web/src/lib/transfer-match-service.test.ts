import { describe, expect, it } from "vitest";
import {
  AUTO_MATCH_THRESHOLD,
  canonicalPremiershipTeamName,
  matchPlayers,
  matchTeamName,
  REVIEW_THRESHOLD,
} from "./transfer-match-service";

describe("canonicalPremiershipTeamName", () => {
  it("maps common aliases", () => {
    expect(canonicalPremiershipTeamName("newcastle red bulls")).toBe("Newcastle Red Bulls");
    expect(canonicalPremiershipTeamName("Bath Rugby")).toBe("Bath");
  });
});

describe("matchTeamName", () => {
  const teams = [
    { id: "t-bath", name: "Bath" },
    { id: "t-sale", name: "Sale Sharks" },
  ];

  it("matches exact team names", () => {
    const result = matchTeamName("Sale Sharks", teams);
    expect(result.teamId).toBe("t-sale");
    expect(result.matched).toBe(true);
  });

  it("returns unmatched for unknown teams", () => {
    const result = matchTeamName("Montpellier", teams);
    expect(result.teamId).toBeNull();
    expect(result.matched).toBe(false);
  });
});

describe("matchPlayers", () => {
  const teams = [{ id: "t-bath", name: "Bath" }];
  const candidates = [
    {
      id: "p-1",
      name: "Finn Russell",
      birthDate: "1992-10-09",
      nationCode: "SCO",
      clubTeamId: "t-bath",
      clubName: "Bath",
      positionName: "fly-half",
    },
    {
      id: "p-2",
      name: "Finn Russel",
      birthDate: null,
      nationCode: "SCO",
      clubTeamId: "t-bath",
      clubName: "Bath",
      positionName: "fly-half",
    },
  ];

  it("ranks exact matches highest", () => {
    const matches = matchPlayers({
      name: "Finn Russell",
      currentTeamId: "t-bath",
      positionName: "fly-half",
      candidates,
      teams,
    });
    expect(matches[0]?.id).toBe("p-1");
    expect(matches[0]?.score).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it("includes fuzzy matches above review threshold", () => {
    const matches = matchPlayers({
      name: "Finn Russell",
      candidates,
      teams,
    });
    expect(matches.some((m) => m.id === "p-2")).toBe(true);
    expect(matches.every((m) => m.score >= REVIEW_THRESHOLD)).toBe(true);
  });
});
