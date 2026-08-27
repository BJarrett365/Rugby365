import { describe, expect, it } from "vitest";
import { coachHeroNameLines } from "./coach-display-name";

describe("coachHeroNameLines", () => {
  it("composes Johan + Rassie as the approved two-line hero", () => {
    expect(
      coachHeroNameLines({
        name: "Rassie Erasmus",
        knownAs: "Rassie",
        fullName: "Johan Erasmus",
      }),
    ).toEqual({ line1: 'JOHAN "RASSIE"', line2: "ERASMUS" });
  });

  it("does not duplicate a nickname already in the full name", () => {
    expect(
      coachHeroNameLines({
        name: "Rassie Erasmus",
        knownAs: "Rassie",
        fullName: 'Johan "Rassie" Erasmus',
      }),
    ).toEqual({ line1: 'JOHAN "RASSIE"', line2: "ERASMUS" });
  });

  it("falls back to the CMS name", () => {
    expect(coachHeroNameLines({ name: "Andy Farrell" })).toEqual({
      line1: "ANDY",
      line2: "FARRELL",
    });
  });
});
