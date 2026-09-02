import { describe, expect, it } from "vitest";
import {
  applyRugbyChampionshipLineageSeasonLabels,
  canonicalRugbyChampionshipSlug,
  formatRugbyChampionshipSeasonDisplayLabel,
  isRugbyChampionshipLineageSlug,
  isRugbyChampionshipPickerYear,
  rugbyChampionshipCompetitionDisplayNameForYear,
  rugbyChampionshipEraForYear,
  rugbyChampionshipEraLabel,
  rugbyChampionshipParticipantKeys,
  rugbyChampionshipPickerDisplayLabel,
  rugbyChampionshipSeasonDisplaySuffix,
  rugbyChampionshipTableNote,
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
