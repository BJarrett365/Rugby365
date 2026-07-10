import { describe, expect, it } from "vitest";
import {
  dedupeSeasonsByYear,
  decorateSeasonPickerRows,
  pickDefaultSeasonForPicker,
} from "./season-list-utils";

describe("season-list-utils", () => {
  it("keeps one season per competition year with canonical labels", () => {
    const compId = "prem";
    const rows = dedupeSeasonsByYear([
      { id: "a", label: "2026", year: 2026, competitionId: compId, isActive: false },
      { id: "b", label: "2026\u201327", year: 2026, competitionId: compId, isActive: true },
      { id: "c", label: "2025", year: 2025, competitionId: compId, isActive: false },
      { id: "d", label: "2025\u201326", year: 2025, competitionId: compId, isActive: false },
      { id: "e", label: "2024", year: 2024, competitionId: compId, isActive: false },
    ]);

    expect(rows.map((row) => row.label)).toEqual(["2026\u201327", "2025\u201326", "2024\u201325"]);
  });

  it("adds display labels for current and previous seasons", () => {
    const rows = decorateSeasonPickerRows(
      [{ id: "a", label: "2026\u201327", year: 2026, competitionId: "prem", isActive: true }],
      new Date("2026-07-07"),
    );
    expect(rows[0]?.displayLabel).toBe("2026\u201327");
  });

  it("defaults to calendar-current season when present", () => {
    const picked = pickDefaultSeasonForPicker(
      [
        { id: "old", label: "2017\u201318", year: 2017, competitionId: "prem" },
        { id: "prev", label: "2025\u201326", year: 2025, competitionId: "prem" },
        { id: "cur", label: "2026\u201327", year: 2026, competitionId: "prem" },
      ],
      new Date("2026-07-07"),
    );
    expect(picked?.id).toBe("cur");
  });

  it("falls back to previous season when current year is not in the catalog", () => {
    const picked = pickDefaultSeasonForPicker(
      [
        { id: "old", label: "2017\u201318", year: 2017, competitionId: "prem" },
        { id: "prev", label: "2025\u201326", year: 2025, competitionId: "prem" },
      ],
      new Date("2026-07-07"),
    );
    expect(picked?.id).toBe("prev");
  });
});
