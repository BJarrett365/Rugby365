import { describe, expect, it } from "vitest";
import {
  applyUrcLineageSeasonLabels,
  urcCompetitionDisplayNameForYear,
  urcEraForYear,
  urcSeasonPickerDisplayLabel,
  urcSeasonUsesConferenceTables,
  urcSeasonUsesPoolTables,
  urcSeasonUsesSplitTables,
  urcSplitGroupLabel,
  urcStandingViewForSplit,
} from "./urc-lineage";

describe("urc-lineage", () => {
  it("maps season start years to historic brands", () => {
    expect(urcEraForYear(2002)).toBe("celtic-league");
    expect(urcEraForYear(2006)).toBe("magners-league");
    expect(urcEraForYear(2011)).toBe("rabodirect-pro12");
    expect(urcEraForYear(2014)).toBe("guinness-pro12");
    expect(urcEraForYear(2017)).toBe("guinness-pro14");
    expect(urcEraForYear(2021)).toBe("united-rugby-championship");
  });

  it("uses Pool A/B only for 2001–02", () => {
    expect(urcSeasonUsesPoolTables(2001)).toBe(true);
    expect(urcSeasonUsesPoolTables(2002)).toBe(false);
    expect(urcSeasonUsesPoolTables(2003)).toBe(false);
  });

  it("uses Conference A/B for Guinness PRO14 2017–20", () => {
    expect(urcSeasonUsesConferenceTables(2016)).toBe(false);
    expect(urcSeasonUsesConferenceTables(2017)).toBe(true);
    expect(urcSeasonUsesConferenceTables(2020)).toBe(true);
    expect(urcSeasonUsesConferenceTables(2021)).toBe(false);
    expect(urcSeasonUsesSplitTables(2001)).toBe(true);
    expect(urcSeasonUsesSplitTables(2018)).toBe(true);
    expect(urcSeasonUsesSplitTables(2010)).toBe(false);
  });

  it("builds split standing view keys and labels", () => {
    expect(urcStandingViewForSplit("pool", "A")).toBe("pool_a");
    expect(urcStandingViewForSplit("conference", "B")).toBe("conference_b");
    expect(urcSplitGroupLabel("pool", "a")).toBe("Pool A");
    expect(urcSplitGroupLabel("conference", "b")).toBe("Conference B");
  });

  it("decorates picker labels with era names", () => {
    expect(urcSeasonPickerDisplayLabel(2002, "2002–03")).toBe("2002–03 · Celtic League");
    expect(urcSeasonPickerDisplayLabel(2009, "2009–10")).toBe("2009–10 · Magners League");
    expect(urcSeasonPickerDisplayLabel(2012, "2012–13")).toBe("2012–13 · RaboDirect PRO12");
    expect(urcSeasonPickerDisplayLabel(2021, "2021–22")).toBe(
      "2021–22 · United Rugby Championship",
    );
    expect(urcSeasonPickerDisplayLabel(2025, "2025–26")).toBe(
      "2025–26 · United Rugby Championship",
    );
    expect(urcCompetitionDisplayNameForYear(2018)).toBe("Guinness PRO14");
  });

  it("applies lineage labels for URC slug only", () => {
    const rows = applyUrcLineageSeasonLabels("united-rugby-championship", [
      { year: 2002, label: "2002–03", displayLabel: "2002–03" },
      { year: 2025, label: "2025–26", displayLabel: "2025–26" },
    ]);
    expect(rows[0]?.displayLabel).toBe("2002–03 · Celtic League");
    expect(rows[0]?.era).toBe("Celtic League");
    expect(rows[1]?.displayLabel).toBe("2025–26 · United Rugby Championship");
  });
});
