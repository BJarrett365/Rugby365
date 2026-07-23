import { describe, expect, it } from "vitest";
import { listMissingWikiFillFields } from "./player-wikipedia-gap-service";
import { normalizeWikidataId } from "@rugby365/import-sdk";

describe("listMissingWikiFillFields", () => {
  it("reports only blank bio/social fields", () => {
    expect(
      listMissingWikiFillFields({
        birthDate: "1995-01-01",
        birthPlace: "Bath",
        heightCm: 185,
        weightKg: 95,
        socialAccounts: { twitter: "https://x.com/a", instagram: null, facebook: "" },
      }),
    ).toEqual(["instagram", "facebook"]);
  });

  it("treats zero height/weight as missing", () => {
    expect(
      listMissingWikiFillFields({
        birthDate: null,
        birthPlace: "  ",
        heightCm: 0,
        weightKg: null,
        socialAccounts: {},
      }),
    ).toEqual(["birthDate", "birthPlace", "heightCm", "weightKg", "twitter", "instagram", "facebook"]);
  });
});

describe("normalizeWikidataId", () => {
  it("normalizes Q-ids", () => {
    expect(normalizeWikidataId("q42")).toBe("Q42");
    expect(normalizeWikidataId("42")).toBe("Q42");
    expect(normalizeWikidataId("")).toBeNull();
  });
});
