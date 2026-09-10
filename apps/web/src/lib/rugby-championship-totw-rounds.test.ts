import { describe, expect, it } from "vitest";
import {
  buildRugbyChampionshipTotwPickerSeasons,
  rugbyChampionshipTotwPoolRoundCount,
  rugbyChampionshipTotwUnavailableReason,
} from "./rugby-championship-totw-rounds";

describe("rugbyChampionshipTotwUnavailableReason", () => {
  it("explains 2026 was not held", () => {
    expect(rugbyChampionshipTotwUnavailableReason(2026, "round-1")).toBe(
      "The Rugby Championship was not held this season.",
    );
  });

  it("explains knockout rounds are not part of the Championship", () => {
    expect(rugbyChampionshipTotwUnavailableReason(2012, "bronze-final")).toMatch(/does not play/i);
    expect(rugbyChampionshipTotwUnavailableReason(2019, "quarter-finals")).toMatch(/does not play/i);
  });

  it("explains shortened World Cup-year rounds that were not played", () => {
    expect(rugbyChampionshipTotwUnavailableReason(2015, "round-4")).toMatch(/shortened/i);
    expect(rugbyChampionshipTotwUnavailableReason(2019, "round-5")).toMatch(/shortened/i);
    expect(rugbyChampionshipTotwUnavailableReason(2023, "round-6")).toMatch(/shortened/i);
  });

  it("allows real pool rounds", () => {
    expect(rugbyChampionshipTotwUnavailableReason(2012, "round-1")).toBeNull();
    expect(rugbyChampionshipTotwUnavailableReason(2012, "round-6")).toBeNull();
    expect(rugbyChampionshipTotwUnavailableReason(2015, "round-3")).toBeNull();
    expect(rugbyChampionshipTotwUnavailableReason(2020, "round-6")).toBeNull();
  });
});

describe("rugbyChampionshipTotwPoolRoundCount", () => {
  it("uses 6 rounds for full seasons, 3 for World Cup years, 6 singles in 2020", () => {
    expect(rugbyChampionshipTotwPoolRoundCount(2012)).toBe(6);
    expect(rugbyChampionshipTotwPoolRoundCount(2015)).toBe(3);
    expect(rugbyChampionshipTotwPoolRoundCount(2020)).toBe(6);
    expect(rugbyChampionshipTotwPoolRoundCount(2026)).toBe(0);
  });
});

describe("buildRugbyChampionshipTotwPickerSeasons", () => {
  it("always lists 2012–2026 with RWC-style knockout labels", () => {
    const seasons = buildRugbyChampionshipTotwPickerSeasons([]);
    expect(seasons[0]?.year).toBe(2026);
    expect(seasons.at(-1)?.year).toBe(2012);
    const keys = seasons.find((s) => s.year === 2012)?.rounds.map((r) => r.roundKey) ?? [];
    expect(keys).toContain("round-1");
    expect(keys).toContain("quarter-finals");
    expect(keys).toContain("bronze-final");
    expect(keys).toContain("team-of-the-tournament");
  });
});
