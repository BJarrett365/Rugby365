import { describe, expect, it } from "vitest";
import { canonicalSeasonPickerScore } from "../season-label-utils";
import { dedupeSeasonsByYear } from "../season-list-utils";

describe("Premiership season resolution", () => {
  it("prefers slug season 2024-25 over numeric 2024 even when numeric has more standings", () => {
    const compId = "prem";
    const scoreSlug = canonicalSeasonPickerScore({
      label: "2024\u201325",
      slug: "2024-25",
      isActive: false,
      standingsCount: 0,
    });
    const scoreNumeric = canonicalSeasonPickerScore({
      label: "2024",
      slug: "2024",
      isActive: true,
      standingsCount: 30,
    });
    expect(scoreSlug).toBeGreaterThan(scoreNumeric);

    const rows = dedupeSeasonsByYear([
      { id: "numeric", label: "2024", year: 2024, competitionId: compId, isActive: true },
      {
        id: "slug",
        label: "2024\u201325",
        year: 2024,
        competitionId: compId,
        isActive: false,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("slug");
    expect(rows[0]?.label).toBe("2024\u201325");
  });

  it("normalizes lone numeric season labels to slug form in picker", () => {
    const rows = dedupeSeasonsByYear([
      { id: "only", label: "2025", year: 2025, competitionId: "prem", isActive: true },
    ]);
    expect(rows[0]?.label).toBe("2025\u201326");
  });
});
