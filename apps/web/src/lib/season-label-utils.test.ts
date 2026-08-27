import { describe, expect, it } from "vitest";
import {
  buildDomesticSeasonCatalog,
  currentDomesticSeasonStartYear,
  formatSeasonPickerLabel,
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
  seasonStatusForStartYear,
} from "./season-label-utils";

describe("season-label-utils", () => {
  it("formats cross-year labels with an en-dash", () => {
    expect(formatSeasonRangeLabel(2025)).toBe("2025\u201326");
    expect(formatSeasonRangeLabel(1987)).toBe("1987\u201388");
  });

  it("parses slash and dash season labels", () => {
    expect(parseSeasonStartYear("2025/26")).toBe(2025);
    expect(parseSeasonStartYear("2025\u201326")).toBe(2025);
    expect(parseSeasonStartYear("2012\u20132013")).toBe(2012);
    expect(parseSeasonStartYear("2012-2013")).toBe(2012);
    expect(parseSeasonStartYear("2026")).toBe(2026);
    expect(parseSeasonStartYear(null)).toBeNull();
    expect(parseSeasonStartYear(undefined)).toBeNull();
    expect(parseSeasonStartYear("")).toBeNull();
  });

  it("normalizes labels to 2025\u201326 format", () => {
    expect(normalizeSeasonLabel("2025/26")).toBe("2025\u201326");
    expect(normalizeSeasonLabel("2025")).toBe("2025\u201326");
  });

  it("treats July as the start of the new domestic season window", () => {
    expect(currentDomesticSeasonStartYear(new Date("2026-07-07"))).toBe(2026);
    expect(currentDomesticSeasonStartYear(new Date("2026-06-30"))).toBe(2025);
  });

  it("marks previous and current seasons for picker labels", () => {
    const referenceDate = new Date("2026-07-07");
    expect(seasonStatusForStartYear(2026, referenceDate)).toBe("current");
    expect(seasonStatusForStartYear(2025, referenceDate)).toBe("previous");
    expect(formatSeasonPickerLabel("2025\u201326", "previous")).toBe("2025\u201326 — just finished");
    expect(formatSeasonPickerLabel("2026\u201327", "current")).toBe("2026\u201327");
  });

  it("builds a domestic catalog back to 1987\u201388", () => {
    const catalog = buildDomesticSeasonCatalog(1987, 2026);
    expect(catalog[0]?.label).toBe("2026\u201327");
    expect(catalog.at(-1)?.label).toBe("1987\u201388");
    expect(catalog).toHaveLength(40);
  });
});
