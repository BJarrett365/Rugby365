import { describe, expect, it } from "vitest";
import {
  dayBoundsInTimeZone,
  hasRequiredMatchCmsFilters,
  utcDayBoundsFromDateKeys,
} from "./match-cms-date-bounds";

describe("hasRequiredMatchCmsFilters", () => {
  it("requires from and to; competition is optional", () => {
    expect(
      hasRequiredMatchCmsFilters({
        fromDate: "2026-07-10",
        toDate: "2026-07-10",
        competitionId: "c1",
      }),
    ).toBe(true);
    expect(
      hasRequiredMatchCmsFilters({
        fromDate: "2026-07-10",
        toDate: "2026-07-10",
        competitionId: "",
      }),
    ).toBe(true);
    expect(
      hasRequiredMatchCmsFilters({
        fromDate: "2026-07-10",
        toDate: null,
        competitionId: "c1",
      }),
    ).toBe(false);
  });
});

describe("dayBoundsInTimeZone", () => {
  it("covers a London winter day as half-open UTC interval", () => {
    const { start, endExclusive } = dayBoundsInTimeZone("2026-01-15", "Europe/London");
    expect(start.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("handles BST summer offset", () => {
    const { start, endExclusive } = dayBoundsInTimeZone("2026-07-10", "Europe/London");
    expect(start.toISOString()).toBe("2026-07-09T23:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-07-10T23:00:00.000Z");
  });
});

describe("utcDayBoundsFromDateKeys", () => {
  it("spans inclusive local days", () => {
    const { start, endExclusive } = utcDayBoundsFromDateKeys({
      fromDate: "2026-07-10",
      toDate: "2026-07-11",
      timeZone: "Europe/London",
    });
    expect(start.toISOString()).toBe("2026-07-09T23:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-07-11T23:00:00.000Z");
  });
});
