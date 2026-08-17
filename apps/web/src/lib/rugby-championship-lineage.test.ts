import { describe, expect, it } from "vitest";
import {
  formatRugbyChampionshipSeasonDisplayLabel,
  isRugbyChampionshipLineageSlug,
  isRugbyChampionshipPickerYear,
  rugbyChampionshipEraForYear,
  rugbyChampionshipEraLabel,
  rugbyChampionshipPickerDisplayLabel,
  rugbyChampionshipSeasonDisplaySuffix,
  RUGBY_CHAMPIONSHIP_FIRST_YEAR,
  TRI_NATIONS_FIRST_YEAR,
} from "./rugby-championship-lineage";

describe("rugby championship lineage", () => {
  it("maps years to Tri Nations / Rugby Championship eras", () => {
    expect(rugbyChampionshipEraForYear(1987)).toBe("pre-tri-nations");
    expect(rugbyChampionshipEraForYear(TRI_NATIONS_FIRST_YEAR)).toBe("tri-nations");
    expect(rugbyChampionshipEraForYear(2011)).toBe("tri-nations");
    expect(rugbyChampionshipEraForYear(RUGBY_CHAMPIONSHIP_FIRST_YEAR)).toBe("rugby-championship");
    expect(rugbyChampionshipEraForYear(2025)).toBe("rugby-championship");
  });

  it("uses full-year display labels for the season picker", () => {
    expect(formatRugbyChampionshipSeasonDisplayLabel(2012)).toBe("2012\u20132013");
    expect(formatRugbyChampionshipSeasonDisplayLabel(2022)).toBe("2022\u20132023");
    expect(rugbyChampionshipPickerDisplayLabel(2012)).toBe("2012\u20132013");
    expect(rugbyChampionshipPickerDisplayLabel(2011)).toBe("2011\u20132012 · Tri Nations");
  });

  it("builds season picker suffixes for pre-RC eras", () => {
    expect(rugbyChampionshipSeasonDisplaySuffix(2009)).toBe(" · Tri Nations");
    expect(rugbyChampionshipSeasonDisplaySuffix(1990)).toBe(" · Pre–Tri Nations");
    expect(rugbyChampionshipSeasonDisplaySuffix(2024)).toBe("");
  });

  it("labels eras for UI copy", () => {
    expect(rugbyChampionshipEraLabel("tri-nations")).toBe("Tri Nations");
    expect(rugbyChampionshipEraLabel("rugby-championship")).toBe("Rugby Championship");
  });

  it("recognises lineage slugs and picker years", () => {
    expect(isRugbyChampionshipLineageSlug("rugby-championship")).toBe(true);
    expect(isRugbyChampionshipLineageSlug("tri-nations")).toBe(true);
    expect(isRugbyChampionshipLineageSlug("premiership")).toBe(false);
    expect(isRugbyChampionshipPickerYear(1995)).toBe(false);
    expect(isRugbyChampionshipPickerYear(1996)).toBe(true);
    expect(isRugbyChampionshipPickerYear(2012)).toBe(true);
  });
});
