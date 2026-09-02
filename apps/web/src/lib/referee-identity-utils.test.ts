import { describe, expect, it } from "vitest";
import {
  isRefereeInternationalAppointment,
  isRefereeTestAppointment,
  parseRefereeOccupation,
  ratingToHundred,
  refereeNationFor,
  refereeUnionFor,
} from "./referee-identity-utils";

describe("referee identity helpers", () => {
  it("parses occupation from Wikipedia notes", () => {
    expect(parseRefereeOccupation("Occupation: Solicitor\n\nWikipedia competitions officiated:")).toBe(
      "Solicitor",
    );
    expect(parseRefereeOccupation(null)).toBeNull();
  });

  it("resolves nation and union for the RWC panel", () => {
    expect(refereeNationFor("Wayne Barnes", null, null)).toBe("England");
    expect(refereeUnionFor("Wayne Barnes", "England")).toBe("RFU");
    expect(refereeNationFor("Jerome Garces", null, null)).toBe("France");
    expect(refereeUnionFor("Nigel Owens", "Wales")).toBe("WRU");
    expect(refereeUnionFor("Nika Amashukeli", "Georgia")).toBe("Georgia Rugby Union");
  });

  it("classifies World Cup and Six Nations as Tests", () => {
    expect(isRefereeInternationalAppointment("world_cup", "Rugby World Cup")).toBe(true);
    expect(isRefereeTestAppointment("world_cup", "Rugby World Cup")).toBe(true);
    expect(isRefereeTestAppointment("domestic", "United Rugby Championship")).toBe(false);
    expect(isRefereeInternationalAppointment("domestic", "United Rugby Championship")).toBe(false);
  });

  it("scales 0–10 ratings onto /100", () => {
    expect(ratingToHundred(8.64)).toBe(86.4);
    expect(ratingToHundred(82.8)).toBe(82.8);
  });
});
