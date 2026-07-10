import { describe, expect, it } from "vitest";
import {
  INJURY_STATUSES,
  injuryStatusLabel,
  isPlayerUnavailableInjury,
  isRecentlyReturnedInjury,
  normalizeInjuryStatus,
  sanitizePublicAvailabilityNotes,
} from "./availability-types";
import { resolveAvailabilityBioTrigger } from "./player-availability-bio-triggers";

describe("injury availability types", () => {
  it("normalizes injury status labels to canonical values", () => {
    expect(normalizeInjuryStatus("Long Term Injury")).toBe("long_term_injury");
    expect(normalizeInjuryStatus("return to training")).toBe("return_to_training");
    expect(normalizeInjuryStatus("unknown")).toBe("injured");
  });

  it("labels all injury statuses for admin UI", () => {
    for (const status of INJURY_STATUSES) {
      expect(injuryStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("marks active unavailable injury statuses", () => {
    expect(isPlayerUnavailableInjury("injured")).toBe(true);
    expect(isPlayerUnavailableInjury("doubtful")).toBe(true);
    expect(isPlayerUnavailableInjury("available")).toBe(false);
    expect(isRecentlyReturnedInjury("returned")).toBe(true);
  });

  it("sanitizes public notes without storing oversized content", () => {
    expect(sanitizePublicAvailabilityNotes("  Public update  ")).toBe("Public update");
    expect(sanitizePublicAvailabilityNotes("")).toBeNull();
    expect(sanitizePublicAvailabilityNotes("x".repeat(2500))?.length).toBe(2000);
  });
});

describe("injury bio automation triggers", () => {
  it("fires when a major public injury is confirmed", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "injury",
        nextStatus: "injured",
      }),
    ).toBe("injury_confirmed");
  });

  it("fires when expected return changes", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "injury",
        previousStatus: "injured",
        nextStatus: "injured",
        expectedReturnDateChanged: true,
      }),
    ).toBe("injury_return_updated");
  });

  it("fires when player returns to training or selection", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "injury",
        previousStatus: "in_rehabilitation",
        nextStatus: "return_to_training",
      }),
    ).toBe("player_returned_to_training");

    expect(
      resolveAvailabilityBioTrigger({
        kind: "injury",
        previousStatus: "return_to_training",
        nextStatus: "returned",
      }),
    ).toBe("player_returned_to_selection");
  });
});
