import { describe, expect, it } from "vitest";
import {
  buildAliasSuggestionsFromContext,
  buildApplyPatch,
  buildDuplicateWarnings,
  detectMissingFields,
  detectProfileConflicts,
  mergeEnrichmentPayload,
  parseAiEnrichmentPayload,
} from "./ai-source-context";
import type { AiSourceSnapshot } from "./ai-enrichment-types";

const playerSnapshot: AiSourceSnapshot = {
  entityType: "player",
  entityId: "player-1",
  entityName: "Beauden Barrett",
  database: {
    name: "Beauden Barrett",
    positionName: "Fly-half",
    countryName: "New Zealand",
    birthDate: "1991-05-27",
    heightCm: 187,
    weightKg: 92,
    clubName: "Blues",
    bioSummary: null,
  },
  sources: {
    wikipediaUrl: "https://en.wikipedia.org/wiki/Beauden_Barrett",
    rugbypassUrl: "https://www.rugbypass.com/players/beauden-barrett/",
    rugbypassHeightCm: 188,
    rugbypassWeightKg: 92,
    squadPositionName: "Outside half",
    internationalTeamName: "All Blacks",
    clubTeamName: "Blues",
  },
  context: {
    seenNames: ["Beauden Barrett", "B. Barrett", "Barrett"],
    duplicates: [{ id: "player-2", name: "Beauden Barrett", slug: "beauden-barrett-2" }],
  },
};

describe("detectMissingFields", () => {
  it("flags empty bio summary for players", () => {
    const missing = detectMissingFields("player", playerSnapshot.database);
    expect(missing.some((field) => field.field === "bioSummary")).toBe(true);
  });
});

describe("detectProfileConflicts", () => {
  it("detects height mismatch between database and RugbyPass", () => {
    const conflicts = detectProfileConflicts(playerSnapshot);
    expect(conflicts.some((conflict) => conflict.field === "heightCm")).toBe(true);
  });

  it("detects position mismatch from squad data", () => {
    const conflicts = detectProfileConflicts(playerSnapshot);
    expect(conflicts.some((conflict) => conflict.field === "positionName")).toBe(true);
  });
});

describe("buildApplyPatch", () => {
  it("does not overwrite populated fields without allowOverwrite", () => {
    const patch = buildApplyPatch(
      "player",
      playerSnapshot.database,
      [
        {
          field: "positionName",
          label: "Position",
          suggestedValue: "Outside half",
          currentValue: "Fly-half",
          confidence: 0.8,
          rationale: "Squad data",
          sourceKeys: ["squads"],
          overwriteRequired: true,
        },
        {
          field: "bioSummary",
          label: "Bio",
          suggestedValue: "World Cup winning playmaker.",
          confidence: 0.9,
          rationale: "Verified career data",
          sourceKeys: ["database", "wikipedia"],
          overwriteRequired: false,
        },
      ],
      ["positionName", "bioSummary"],
      false,
    );

    expect(patch.positionName).toBeUndefined();
    expect(patch.bioSummary).toBe("World Cup winning playmaker.");
  });

  it("allows overwrite when editor explicitly permits it", () => {
    const patch = buildApplyPatch(
      "player",
      playerSnapshot.database,
      [
        {
          field: "positionName",
          label: "Position",
          suggestedValue: "Outside half",
          currentValue: "Fly-half",
          confidence: 0.8,
          rationale: "Squad data",
          sourceKeys: ["squads"],
          overwriteRequired: true,
        },
      ],
      ["positionName"],
      true,
    );

    expect(patch.positionName).toBe("Outside half");
  });
});

describe("parseAiEnrichmentPayload", () => {
  it("parses structured AI output", () => {
    const parsed = parseAiEnrichmentPayload({
      fieldSuggestions: [
        {
          field: "bioSummary",
          label: "Bio summary",
          suggestedValue: "All Blacks fly-half.",
          confidence: 0.88,
          rationale: "Based on verified international career.",
          sourceKeys: ["database"],
          overwriteRequired: false,
        },
      ],
      textSuggestions: [
        {
          key: "playing_style",
          label: "Playing style",
          text: "Attacking distributor with pace.",
          confidence: 0.7,
          rationale: "Editorial summary.",
        },
      ],
      notes: ["No conflicts found."],
    });

    expect(parsed.fieldSuggestions).toHaveLength(1);
    expect(parsed.textSuggestions[0]?.key).toBe("playing_style");
    expect(parsed.notes[0]).toContain("No conflicts");
  });
});

describe("mergeEnrichmentPayload", () => {
  it("merges rule-based missing fields with AI output", () => {
    const merged = mergeEnrichmentPayload(
      detectMissingFields("player", playerSnapshot.database),
      detectProfileConflicts(playerSnapshot),
      parseAiEnrichmentPayload({ notes: ["AI note"] }),
    );

    expect(merged.missingFields.some((field) => field.field === "bioSummary")).toBe(true);
    expect(merged.notes.join(" ")).toContain("potential conflict");
  });
});

describe("buildDuplicateWarnings", () => {
  it("excludes the current entity from duplicate warnings", () => {
    const warnings = buildDuplicateWarnings("player-1", [
      { id: "player-1", name: "Beauden Barrett", slug: "beauden-barrett" },
      { id: "player-2", name: "Beauden Barrett", slug: "beauden-barrett-2" },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.entityId).toBe("player-2");
  });
});

describe("buildAliasSuggestionsFromContext", () => {
  it("suggests seen name variants for players", () => {
    const aliases = buildAliasSuggestionsFromContext("player", playerSnapshot);
    expect(aliases.some((alias) => alias.alias === "B. Barrett")).toBe(true);
  });
});
