import { describe, expect, it } from "vitest";
import {
  canonicalPlayerDisplayName,
  entityNameQualityScore,
  fixReversedTwoWordPlayerName,
  isSdmsExternalId,
  normalizePlayerName,
  normalizeTeamName,
  normalizedEntityKey,
  teamDedupBaseName,
  teamDedupKey,
  teamDedupTier,
} from "./entity-normalize";

describe("normalizeTeamName", () => {
  it("strips provider prefixes and collapses whitespace", () => {
    expect(normalizeTeamName("→Benetton")).toBe("Benetton");
    expect(normalizeTeamName("BT Murrayfield")).toBe("Murrayfield");
    expect(normalizeTeamName("Saracens  RFC")).toBe("Saracens RFC");
  });
});

describe("normalizedEntityKey", () => {
  it("matches teams that differ only by prefix or spacing", () => {
    expect(normalizedEntityKey("→Benetton", "team")).toBe(normalizedEntityKey("Benetton", "team"));
  });

  it("matches bath and bath rugby as the same senior side", () => {
    expect(teamDedupKey("Bath")).toBe(teamDedupKey("Bath Rugby"));
  });

  it("keeps women and age-grade sides separate from senior teams", () => {
    expect(teamDedupKey("England")).not.toBe(teamDedupKey("England Women"));
    expect(teamDedupKey("England")).not.toBe(teamDedupKey("England Red Roses"));
    expect(teamDedupKey("England")).not.toBe(teamDedupKey("England U18"));
    expect(teamDedupKey("England")).not.toBe(teamDedupKey("England U20"));
    expect(teamDedupKey("England U18")).not.toBe(teamDedupKey("England Counties U18s"));
    expect(teamDedupKey("England")).not.toBe(teamDedupKey("England 'A'"));
    expect(teamDedupKey("Scotland")).not.toBe(teamDedupKey("Scotland U16"));
    expect(teamDedupKey("England U20")).toBe(teamDedupKey("England U20s"));
    expect(teamDedupKey("England U20")).toBe(teamDedupKey("England Under 20"));
  });

  it("does not treat sale sharks and sharks as duplicates", () => {
    expect(teamDedupKey("Sale Sharks")).not.toBe(teamDedupKey("Sharks"));
  });

  it("matches players with double spaces", () => {
    expect(normalizedEntityKey("Kieran  Hardy", "player")).toBe(
      normalizedEntityKey("Kieran Hardy", "player"),
    );
  });
});

describe("teamDedupTier", () => {
  it("classifies common representative tiers", () => {
    expect(teamDedupTier("England Red Roses")).toBe("women");
    expect(teamDedupTier("England U18")).toBe("u18");
    expect(teamDedupTier("Wales U20s")).toBe("u20");
    expect(teamDedupTier("Bath Rugby")).toBe("senior");
  });
});

describe("teamDedupBaseName", () => {
  it("strips rugby suffix and age markers from the base label", () => {
    expect(teamDedupBaseName("Bath Rugby")).toBe("bath");
    expect(teamDedupBaseName("England U20s")).toBe("england");
  });
});

describe("entityNameQualityScore", () => {
  it("prefers clean names over prefixed or double-spaced variants", () => {
    expect(entityNameQualityScore("Benetton")).toBeGreaterThan(entityNameQualityScore("→Benetton"));
    expect(entityNameQualityScore("Kieran Hardy")).toBeGreaterThan(
      entityNameQualityScore("Kieran  Hardy"),
    );
  });
});

describe("isSdmsExternalId", () => {
  it("detects SDMS-style ids", () => {
    expect(isSdmsExternalId("2-12345")).toBe(true);
    expect(isSdmsExternalId("sport365-abc")).toBe(false);
  });
});

describe("normalizePlayerName", () => {
  it("collapses whitespace in player names", () => {
    expect(normalizePlayerName("Kieran  Hardy")).toBe("Kieran Hardy");
  });
});

describe("canonicalPlayerDisplayName", () => {
  it("applies explicit Bath-style corrections", () => {
    expect(canonicalPlayerDisplayName("Cowan Tom")).toBe("Thompson Cowan");
    expect(canonicalPlayerDisplayName("Santiago Carreras")).toBe("Santi Carreras");
    expect(canonicalPlayerDisplayName("William Stuart")).toBe("Will Stuart");
    expect(canonicalPlayerDisplayName("Tom Carr Smith")).toBe("Tom Carr-Smith");
  });

  it("fixes obvious reversed two-word names", () => {
    expect(fixReversedTwoWordPlayerName("Harris Sam")).toBe("Sam Harris");
  });
});
