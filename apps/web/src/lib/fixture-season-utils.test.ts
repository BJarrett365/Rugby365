import { describe, expect, it } from "vitest";
import {
  groupRowsBySeason,
  resolveFixtureSeasonLabel,
  seasonGroupKey,
} from "./fixture-season-utils";

const PREMIERSHIP_ID = "comp-prem";

describe("resolveFixtureSeasonLabel", () => {
  const seasons = [
    { competitionId: PREMIERSHIP_ID, label: "2025", year: 2025 },
    { competitionId: PREMIERSHIP_ID, label: "2026–27", year: 2026 },
  ];

  it("matches calendar year season", () => {
    expect(
      resolveFixtureSeasonLabel({
        kickoffAt: "2025-03-15T15:00:00Z",
        competitionId: PREMIERSHIP_ID,
        seasons,
      }),
    ).toBe("2025");
  });

  it("matches cross-year season label from kickoff", () => {
    expect(
      resolveFixtureSeasonLabel({
        kickoffAt: "2026-09-12T14:00:00Z",
        competitionId: PREMIERSHIP_ID,
        seasons,
      }),
    ).toBe("2026–27");
  });

  it("falls back to calendar year when no competition season exists", () => {
    expect(
      resolveFixtureSeasonLabel({
        kickoffAt: "2024-01-10T15:00:00Z",
        competitionId: PREMIERSHIP_ID,
        seasons,
      }),
    ).toBe("2024");
  });
});

describe("groupRowsBySeason", () => {
  it("groups by competition and season", () => {
    const groups = groupRowsBySeason(
      [
        { id: "1", competitionName: "Premiership", seasonLabel: "2025" },
        { id: "2", competitionName: "Premiership", seasonLabel: "2026–27" },
        { id: "3", competitionName: "Premiership", seasonLabel: "2025" },
      ],
      (row) => ({ competitionName: row.competitionName, seasonLabel: row.seasonLabel }),
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.key).toBe(seasonGroupKey("Premiership", "2026–27"));
    expect(groups[0]!.items).toHaveLength(1);
    expect(groups[1]!.items).toHaveLength(2);
  });
});
