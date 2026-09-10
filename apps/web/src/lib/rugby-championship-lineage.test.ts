import { describe, expect, it } from "vitest";
import {
  applyRugbyChampionshipLineageSeasonLabels,
  canonicalRugbyChampionshipSlug,
  formatRugbyChampionshipSeasonDisplayLabel,
  isRugbyChampionshipLineageSlug,
  isRugbyChampionshipParticipantMatch,
  isRugbyChampionshipPickerYear,
  rugbyChampionshipChampionDisplayName,
  rugbyChampionshipCompetitionDisplayNameForYear,
  rugbyChampionshipEraForYear,
  rugbyChampionshipEraLabel,
  rugbyChampionshipExpectedFixtureCount,
  rugbyChampionshipParticipantKeys,
  rugbyChampionshipPickerDisplayLabel,
  rugbyChampionshipSeasonDisplaySuffix,
  rugbyChampionshipTableNote,
  RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR,
  RUGBY_CHAMPIONSHIP_FIRST_YEAR,
  TRI_NATIONS_FIRST_YEAR,
} from "./rugby-championship-lineage";

describe("rugby championship lineage", () => {
  it("maps years to Tri Nations / Rugby Championship eras", () => {
    expect(rugbyChampionshipEraForYear(1987)).toBe("pre-tri-nations");
    expect(rugbyChampionshipEraForYear(TRI_NATIONS_FIRST_YEAR)).toBe("tri-nations");
    expect(rugbyChampionshipEraForYear(2011)).toBe("tri-nations");
    expect(rugbyChampionshipEraForYear(RUGBY_CHAMPIONSHIP_FIRST_YEAR)).toBe("rugby-championship");
    expect(rugbyChampionshipEraForYear(2020)).toBe("rugby-championship");
    expect(rugbyChampionshipEraForYear(2025)).toBe("rugby-championship");
  });

  it("uses calendar-year picker labels with the era name", () => {
    expect(formatRugbyChampionshipSeasonDisplayLabel(2012)).toBe("2012");
    expect(formatRugbyChampionshipSeasonDisplayLabel(1996)).toBe("1996");
    expect(rugbyChampionshipPickerDisplayLabel(2012)).toBe("2012 · The Rugby Championship");
    expect(rugbyChampionshipPickerDisplayLabel(2011)).toBe("2011 · Tri Nations");
    expect(rugbyChampionshipPickerDisplayLabel(2020)).toBe("2020 · The Rugby Championship");
  });

  it("builds season picker suffixes for each era", () => {
    expect(rugbyChampionshipSeasonDisplaySuffix(2009)).toBe(" · Tri Nations");
    expect(rugbyChampionshipSeasonDisplaySuffix(1990)).toBe(" · Pre–Tri Nations");
    expect(rugbyChampionshipSeasonDisplaySuffix(2024)).toBe(" · The Rugby Championship");
  });

  it("labels eras for UI copy", () => {
    expect(rugbyChampionshipEraLabel("tri-nations")).toBe("Tri Nations");
    expect(rugbyChampionshipEraLabel("rugby-championship")).toBe("The Rugby Championship");
    expect(rugbyChampionshipCompetitionDisplayNameForYear(2008)).toBe("Tri Nations");
    expect(rugbyChampionshipCompetitionDisplayNameForYear(2012)).toBe("The Rugby Championship");
  });

  it("recognises lineage slugs and picker years", () => {
    expect(isRugbyChampionshipLineageSlug("rugby-championship")).toBe(true);
    expect(isRugbyChampionshipLineageSlug("tri-nations")).toBe(true);
    expect(isRugbyChampionshipLineageSlug("the-rugby-championship")).toBe(true);
    expect(isRugbyChampionshipLineageSlug("premiership")).toBe(false);
    expect(canonicalRugbyChampionshipSlug("tri-nations")).toBe("rugby-championship");
    expect(canonicalRugbyChampionshipSlug("the-rugby-championship")).toBe("rugby-championship");
    expect(isRugbyChampionshipPickerYear(1995)).toBe(false);
    expect(isRugbyChampionshipPickerYear(1996)).toBe(true);
    expect(isRugbyChampionshipPickerYear(2012)).toBe(true);
  });

  it("lists the sides that contested each era", () => {
    expect([...rugbyChampionshipParticipantKeys(2009)].sort()).toEqual([
      "australia",
      "new zealand",
      "south africa",
    ]);
    expect([...rugbyChampionshipParticipantKeys(2012)].sort()).toEqual([
      "argentina",
      "australia",
      "new zealand",
      "south africa",
    ]);
    expect([...rugbyChampionshipParticipantKeys(2020)].sort()).toEqual([
      "argentina",
      "australia",
      "new zealand",
    ]);
  });

  it("explains the 2020 COVID three-team series", () => {
    expect(rugbyChampionshipTableNote(2020)).toMatch(/South Africa withdrew/);
    expect(rugbyChampionshipTableNote(2003)).toMatch(/Tri Nations/);
    expect(rugbyChampionshipTableNote(2024)).toBeNull();
  });

  it("explains that SANZAAR did not stage the 2026 tournament", () => {
    expect(rugbyChampionshipTableNote(2026)).toMatch(/not held/i);
    expect(rugbyChampionshipExpectedFixtureCount(2026)).toBe(0);
  });

  it("uses verified 2012–2026 Championship match counts", () => {
    expect(RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR).toEqual({
      2012: 12,
      2013: 12,
      2014: 12,
      2015: 6,
      2016: 12,
      2017: 12,
      2018: 12,
      2019: 6,
      2020: 6,
      2021: 12,
      2022: 12,
      2023: 6,
      2024: 12,
      2025: 12,
      2026: 0,
    });
    expect(
      Object.entries(RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR).reduce(
        (sum, [, count]) => sum + count,
        0,
      ),
    ).toBe(144);
    // 2012–2025 are completed Championship/Tri Nations results; 2026 was not held.
    expect(rugbyChampionshipExpectedFixtureCount(2015)).toBe(6);
    expect(rugbyChampionshipExpectedFixtureCount(2020)).toBe(6);
    expect(rugbyChampionshipExpectedFixtureCount(2023)).toBe(6);
  });

  it("rejects club warm-up matches that appear on Wikipedia season pages", () => {
    expect(isRugbyChampionshipParticipantMatch("Argentina", "Stade Français", 2012)).toBe(false);
    expect(isRugbyChampionshipParticipantMatch("Argentina", "NSW Barbarians", 2013)).toBe(false);
    expect(isRugbyChampionshipParticipantMatch("Argentina", "Grenoble", 2014)).toBe(false);
    expect(isRugbyChampionshipParticipantMatch("South Africa", "Argentina", 2012)).toBe(true);
    expect(isRugbyChampionshipParticipantMatch("All Blacks", "Wallabies", 2025)).toBe(true);
    expect(isRugbyChampionshipParticipantMatch("South Africa", "New Zealand", 2020)).toBe(false);
    expect(rugbyChampionshipChampionDisplayName("AUS")).toBe("Australia");
    expect(rugbyChampionshipChampionDisplayName("NZL")).toBe("New Zealand");
  });

  it("applies era labels on the canonical slug", () => {
    const rows = applyRugbyChampionshipLineageSeasonLabels("rugby-championship", [
      { id: "a", year: 2011, label: "2011", displayLabel: "2011" },
      { id: "b", year: 2012, label: "2012", displayLabel: "2012" },
    ]);
    expect(rows[0]?.displayLabel).toBe("2011 · Tri Nations");
    expect(rows[0]?.era).toBe("Tri Nations");
    expect(rows[1]?.displayLabel).toBe("2012 · The Rugby Championship");
  });
});
