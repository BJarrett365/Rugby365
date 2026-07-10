import { describe, expect, it } from "vitest";
import {
  isPlayerUnavailableSuspension,
  normalizeSuspensionStatus,
  SUSPENSION_STATUSES,
  suspensionStatusLabel,
} from "./availability-types";
import { resolveAvailabilityBioTrigger } from "./player-availability-bio-triggers";

describe("suspension availability types", () => {
  it("normalizes suspension status labels to canonical values", () => {
    expect(normalizeSuspensionStatus("Pending Hearing")).toBe("pending_hearing");
    expect(normalizeSuspensionStatus("Serving Suspension")).toBe("serving_suspension");
    expect(normalizeSuspensionStatus("unknown")).toBe("suspended");
  });

  it("labels all suspension statuses for admin UI", () => {
    for (const status of SUSPENSION_STATUSES) {
      expect(suspensionStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("marks active unavailable suspension statuses", () => {
    expect(isPlayerUnavailableSuspension("suspended")).toBe(true);
    expect(isPlayerUnavailableSuspension("serving_suspension")).toBe(true);
    expect(isPlayerUnavailableSuspension("available_again")).toBe(false);
    expect(isPlayerUnavailableSuspension("overturned")).toBe(false);
  });
});

describe("suspension bio automation triggers", () => {
  it("fires when a suspension begins", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "suspension",
        previousStatus: "pending_hearing",
        nextStatus: "suspended",
      }),
    ).toBe("suspension_began");
  });

  it("fires when a suspension ends", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "suspension",
        previousStatus: "serving_suspension",
        nextStatus: "available_again",
      }),
    ).toBe("suspension_ended");

    expect(
      resolveAvailabilityBioTrigger({
        kind: "suspension",
        previousStatus: "suspended",
        nextStatus: "overturned",
      }),
    ).toBe("suspension_ended");
  });

  it("does not fire for unchanged non-terminal statuses", () => {
    expect(
      resolveAvailabilityBioTrigger({
        kind: "suspension",
        previousStatus: "serving_suspension",
        nextStatus: "serving_suspension",
      }),
    ).toBeNull();
  });
});
