import { describe, expect, it } from "vitest";
import {
  canonicalPlayerDisplayName,
  entityNameQualityScore,
  fixReversedTwoWordPlayerName,
  isJunkPlayerName,
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

  it("treats DHL Stormers XXIII as the same club as Stormers", () => {
    expect(teamDedupKey("DHL Stormers XXIII")).toBe(teamDedupKey("Stormers"));
    expect(teamDedupBaseName("DHL Stormers XXIII")).toBe("stormers");
  });

  it("does not merge Sale Sharks with Sharks after sponsor strip", () => {
    expect(teamDedupKey("Sale Sharks")).not.toBe(teamDedupKey("Sharks"));
  });

  it("aliases SA franchise / Currie Cup union names onto one senior identity", () => {
    expect(teamDedupKey("Blue Bulls")).toBe(teamDedupKey("Bulls"));
    expect(teamDedupKey("Northern Bulls")).toBe(teamDedupKey("Bulls"));
    expect(teamDedupKey("Golden Lions")).toBe(teamDedupKey("Lions"));
    expect(teamDedupKey("Gauteng Lions")).toBe(teamDedupKey("Lions"));
    expect(teamDedupKey("Natal Sharks")).toBe(teamDedupKey("Sharks"));
    expect(teamDedupKey("Coastal Sharks")).toBe(teamDedupKey("Sharks"));
    expect(teamDedupKey("Free State Cheetahs")).toBe(teamDedupKey("Cheetahs"));
    expect(teamDedupKey("Western Stormers")).toBe(teamDedupKey("Stormers"));
    expect(teamDedupKey("Western Province")).not.toBe(teamDedupKey("Stormers"));
    expect(teamDedupKey("Wellington Lions")).not.toBe(teamDedupKey("Lions"));
  });

  it("strips Wikipedia cite brackets from the base label", () => {
    expect(teamDedupBaseName("Clermont [2]")).toBe("clermont");
    expect(teamDedupKey("Clermont [6]")).toBe(teamDedupKey("Clermont"));
  });

  it("collapses British & Irish Lions wiki/historic variants", () => {
    expect(teamDedupKey("23px British & Irish Lions")).toBe(teamDedupKey("British & Irish Lions"));
    expect(teamDedupKey("British & Irish Lions 23px")).toBe(teamDedupKey("British & Irish Lions"));
    expect(teamDedupKey("British Lions")).toBe(teamDedupKey("British & Irish Lions"));
    expect(teamDedupKey("British and Irish Lions")).toBe(teamDedupKey("British & Irish Lions"));
    expect(normalizeTeamName("23px British & Irish Lions")).toBe("British & Irish Lions");
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

describe("isJunkPlayerName", () => {
  it("flags roster / feed placeholders", () => {
    expect(isJunkPlayerName("To Be ANNOUNCED")).toBe(true);
    expect(isJunkPlayerName("TBA")).toBe(true);
    expect(isJunkPlayerName("-")).toBe(true);
    expect(isJunkPlayerName("Unknown")).toBe(true);
    expect(isJunkPlayerName("Morne Steyn")).toBe(false);
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
