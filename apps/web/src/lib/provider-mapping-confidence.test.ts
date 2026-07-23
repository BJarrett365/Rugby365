import { describe, expect, it } from "vitest";
import {
  applyHardGates,
  mayAutoConfirm,
  mayAutoCreate,
  scoreMappingConfidence,
} from "./provider-mapping-confidence";
import { decideFieldWrite, isEmptyValue } from "./data-integration-overwrite";
import { normalizeSeasonLabel } from "./season-label-utils";
import { WHOLE_RECORD_LOCK_FIELD } from "./provider-mapping-types";

describe("scoreMappingConfidence", () => {
  it("scores exact external id highly and allows auto-confirm for teams", () => {
    const result = scoreMappingConfidence({
      entityType: "team",
      exactExternalIdMatch: true,
    });
    expect(result.confidence).toBeGreaterThanOrEqual(95);
    expect(mayAutoConfirm(result)).toBe(true);
  });

  it("never auto-confirms player name-only matches", () => {
    const result = scoreMappingConfidence({
      entityType: "player",
      normalisedNameMatch: true,
      nameUniqueInScope: true,
    });
    expect(result.confidence).toBeLessThan(60);
    expect(result.blockAutoConfirm).toBe(true);
    expect(mayAutoConfirm(result)).toBe(false);
  });

  it("never auto-creates competitions from name-only", () => {
    const result = scoreMappingConfidence({
      entityType: "competition",
      normalisedNameMatch: true,
      nameUniqueInScope: true,
    });
    expect(result.blockAutoCreate).toBe(true);
    expect(mayAutoCreate(result)).toBe(false);
  });

  it("requires competition context for strong team matches", () => {
    const weak = scoreMappingConfidence({
      entityType: "team",
      normalisedNameMatch: true,
      nameUniqueInScope: true,
    });
    expect(weak.blockAutoConfirm).toBe(true);

    const strong = scoreMappingConfidence({
      entityType: "team",
      normalisedNameMatch: true,
      sameCompetition: true,
      sameCountry: true,
      nameUniqueInScope: true,
    });
    expect(strong.confidence).toBeGreaterThanOrEqual(80);
    expect(strong.blockAutoConfirm).toBe(false);
    // Auto-confirm reserved for ≥90 (exact id / match identity); strong name+context is suggested.
    expect(mayAutoConfirm(strong)).toBe(false);
    expect(mayAutoCreate(strong)).toBe(true);
  });

  it("scores match identity with competition, season, teams and kickoff", () => {
    const result = scoreMappingConfidence({
      entityType: "match",
      sameCompetition: true,
      sameSeason: true,
      sameTeams: true,
      kickoffWithinMinutes: 15,
    });
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(mayAutoConfirm(result)).toBe(true);
  });

  it("marks ambiguous candidate sets as unmapped-band", () => {
    const result = scoreMappingConfidence({
      entityType: "player",
      normalisedNameMatch: true,
      candidateCount: 3,
    });
    expect(result.confidence).toBeLessThan(40);
    expect(result.requiresManualReview).toBe(true);
  });
});

describe("applyHardGates", () => {
  it("forces manual review for player confidence below 95", () => {
    const gated = applyHardGates("player", 90, "player_name_dob_unique", {
      requiresManualReview: false,
      blockAutoConfirm: false,
      blockAutoCreate: false,
    });
    expect(gated.blockAutoConfirm).toBe(true);
    expect(gated.requiresManualReview).toBe(true);
  });
});

describe("decideFieldWrite", () => {
  it("applies primary updates to unlocked primary-owned fields", () => {
    expect(
      decideFieldWrite({
        field: "homeScore",
        currentValue: 10,
        primaryValue: 17,
        source: "primary",
        lockedFields: new Set(),
        primaryOwnsField: true,
      }),
    ).toBe("apply_primary");
  });

  it("skips locked fields", () => {
    expect(
      decideFieldWrite({
        field: "homeScore",
        currentValue: 10,
        primaryValue: 17,
        source: "primary",
        lockedFields: new Set(["homeScore"]),
        primaryOwnsField: true,
      }),
    ).toBe("skip_locked");

    expect(
      decideFieldWrite({
        field: "homeScore",
        currentValue: 10,
        primaryValue: 17,
        source: "primary",
        lockedFields: new Set([WHOLE_RECORD_LOCK_FIELD]),
        primaryOwnsField: true,
      }),
    ).toBe("skip_locked");
  });

  it("allows secondary only to fill empty fields", () => {
    expect(
      decideFieldWrite({
        field: "venueName",
        currentValue: null,
        primaryValue: null,
        secondaryValue: "The Rec",
        source: "secondary",
        lockedFields: new Set(),
      }),
    ).toBe("fill_empty");

    expect(
      decideFieldWrite({
        field: "venueName",
        currentValue: "Recreation Ground",
        primaryValue: null,
        secondaryValue: "The Rec",
        source: "secondary",
        lockedFields: new Set(),
      }),
    ).toBe("conflict");
  });

  it("treats empty strings as empty", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue("  ")).toBe(true);
    expect(isEmptyValue("Bath")).toBe(false);
  });
});

describe("season label normalisation for API sea strings", () => {
  it("normalises slash, hyphen, en-dash and bare years", () => {
    expect(normalizeSeasonLabel("2025/26")).toBe("2025–26");
    expect(normalizeSeasonLabel("2025-26")).toBe("2025–26");
    expect(normalizeSeasonLabel("2025–26")).toBe("2025–26");
    expect(normalizeSeasonLabel("2025")).toBe("2025–26");
  });
});
