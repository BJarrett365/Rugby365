import { describe, expect, it } from "vitest";
import {
  coachFieldProvenanceLabel,
  isCoachAssessment,
  normalizeCoachFieldProvenance,
} from "./coach-field-provenance";

describe("coach field provenance", () => {
  it("normalizes assessment aliases", () => {
    expect(normalizeCoachFieldProvenance("rugby365_assessment")).toBe("rugby365_assessment");
    expect(normalizeCoachFieldProvenance("assessment")).toBe("rugby365_assessment");
    expect(normalizeCoachFieldProvenance("verified_fact")).toBe("verified_fact");
    expect(normalizeCoachFieldProvenance("fact")).toBe("verified_fact");
    expect(normalizeCoachFieldProvenance("")).toBe("unverified");
  });

  it("labels and assessment check", () => {
    expect(coachFieldProvenanceLabel("rugby365_assessment")).toBe("Rugby365 assessment");
    expect(isCoachAssessment("rugby365_assessment")).toBe(true);
    expect(isCoachAssessment("verified_fact")).toBe(false);
  });
});
