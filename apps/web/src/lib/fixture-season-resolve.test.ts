import { describe, expect, it } from "vitest";
import {
  calendarSeasonYearFromKickoff,
  domesticSeasonStartYearFromKickoff,
  fixtureBelongsToSeason,
  kickoffMatchesSeasonYear,
  resolveFixtureSeason,
  seasonKindFromCompetitionType,
  SEASON_STATUS_UNMAPPED,
  type SeasonCandidate,
} from "./fixture-season-resolve";
import { MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE, MATCH_CMS_PAGE_SIZE_DEFAULT } from "./match-cms-list-utils";
import { hasRequiredMatchCmsFilters } from "./match-cms-date-bounds";

const COMP = "comp-1";

function candidates(rows: Array<Partial<SeasonCandidate> & { id: string; year: number; label: string }>): SeasonCandidate[] {
  return rows.map((r) => ({
    competitionId: COMP,
    isDeprecated: false,
    isActive: true,
    ...r,
  }));
}

describe("domesticSeasonStartYearFromKickoff", () => {
  it("uses Aug–Jul window", () => {
    expect(domesticSeasonStartYearFromKickoff("2025-08-01T12:00:00Z")).toBe(2025);
    expect(domesticSeasonStartYearFromKickoff("2026-02-01T12:00:00Z")).toBe(2025);
    expect(domesticSeasonStartYearFromKickoff("2025-07-31T12:00:00Z")).toBe(2024);
  });
});

describe("seasonKindFromCompetitionType", () => {
  it("maps competition types to Rule Book kinds", () => {
    expect(seasonKindFromCompetitionType("domestic")).toBe("club");
    expect(seasonKindFromCompetitionType("european")).toBe("club");
    expect(seasonKindFromCompetitionType("international")).toBe("international");
    expect(seasonKindFromCompetitionType("world_cup")).toBe("tournament");
  });
});

describe("resolveFixtureSeason — club", () => {
  const seasonRows = candidates([
    { id: "s-2425", year: 2024, label: "2024–25" },
    { id: "s-2526", year: 2025, label: "2025–26", isActive: true },
  ]);

  it("resolves Oct and Feb into the same cross-year season", () => {
    const oct = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2025-10-12T14:00:00Z",
      seasonKind: "club",
      candidates: seasonRows,
    });
    const feb = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2026-02-01T15:00:00Z",
      seasonKind: "club",
      candidates: seasonRows,
    });
    expect(oct.seasonId).toBe("s-2526");
    expect(feb.seasonId).toBe("s-2526");
  });

  it("prefers confirmed rugby_data mapping", () => {
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2025-10-12T14:00:00Z",
      confirmedMappingSeasonId: "s-2425",
      candidates: seasonRows,
    });
    expect(result.seasonId).toBe("s-2425");
    expect(result.confidence).toBe(100);
  });

  it("marks ambiguous duplicate window candidates for review", () => {
    const dupes = candidates([
      { id: "a", year: 2025, label: "2025–26" },
      { id: "b", year: 2025, label: "2025–26" },
    ]);
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2026-01-15T15:00:00Z",
      candidates: dupes,
    });
    expect(result.status).toBe(SEASON_STATUS_UNMAPPED);
    expect(result.needsReview).toBe(true);
    expect(result.seasonId).toBeNull();
    expect(result.candidateIds).toHaveLength(2);
  });

  it("returns SEASON_UNMAPPED when no season row matches", () => {
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2022-09-01T12:00:00Z",
      candidates: seasonRows,
    });
    expect(result.status).toBe(SEASON_STATUS_UNMAPPED);
    expect(result.seasonId).toBeNull();
  });
});

describe("resolveFixtureSeason — international / tournament", () => {
  it("resolves Six Nations / RC style calendar year", () => {
    expect(calendarSeasonYearFromKickoff("2026-03-14T15:00:00Z")).toBe(2026);
    const rows = candidates([
      { id: "sn-2025", year: 2025, label: "2025" },
      { id: "sn-2026", year: 2026, label: "2026" },
    ]);
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2026-03-14T15:00:00Z",
      seasonKind: "international",
      candidates: rows,
    });
    expect(result.status).toBe("resolved");
    expect(result.seasonId).toBe("sn-2026");
    expect(result.needsReview).toBe(false);
  });

  it("resolves RWC / Lions style tournament year", () => {
    const rows = candidates([
      { id: "rwc-2023", year: 2023, label: "2023" },
      { id: "rwc-2027", year: 2027, label: "2027" },
    ]);
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2027-09-10T18:00:00Z",
      seasonKind: "tournament",
      candidates: rows,
    });
    expect(result.seasonId).toBe("rwc-2027");
    expect(result.status).toBe("resolved");
  });

  it("does not use club Aug–Jul for international kickoffs in Jan–Jul", () => {
    const rows = candidates([{ id: "sn-2026", year: 2026, label: "2026" }]);
    // Club would map Feb 2026 → 2025 start year; international must stay 2026
    const result = resolveFixtureSeason({
      competitionId: COMP,
      kickoffAt: "2026-02-07T14:00:00Z",
      seasonKind: "international",
      candidates: rows,
    });
    expect(result.seasonId).toBe("sn-2026");
    expect(domesticSeasonStartYearFromKickoff("2026-02-07T14:00:00Z")).toBe(2025);
  });
});

describe("fixtureBelongsToSeason", () => {
  it("includes July internationals in calendar year 2026 (not club Aug–Jul)", () => {
    const july = new Date("2026-07-04T07:10:00.000Z");
    expect(kickoffMatchesSeasonYear(july, 2026, "club")).toBe(false);
    expect(kickoffMatchesSeasonYear(july, 2026, "international")).toBe(true);
    expect(
      fixtureBelongsToSeason({
        fixtureSeasonId: null,
        kickoffAt: july,
        seasonId: "nc-2026",
        seasonYear: 2026,
        seasonKind: "international",
      }),
    ).toBe(true);
  });

  it("prefers explicit fixture.seasonId over kickoff window", () => {
    expect(
      fixtureBelongsToSeason({
        fixtureSeasonId: "nc-2026",
        kickoffAt: "2026-07-04T07:10:00.000Z",
        seasonId: "nc-2026",
        seasonYear: 2026,
        seasonKind: "club", // would fail on kickoff alone
      }),
    ).toBe(true);
    expect(
      fixtureBelongsToSeason({
        fixtureSeasonId: "other",
        kickoffAt: "2026-07-04T07:10:00.000Z",
        seasonId: "nc-2026",
        seasonYear: 2026,
        seasonKind: "international",
      }),
    ).toBe(false);
  });
});

describe("Match CMS gates", () => {
  it("defaults pageSize to 20 and uses Rule Book idle copy", () => {
    expect(MATCH_CMS_PAGE_SIZE_DEFAULT).toBe(20);
    expect(MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE).toBe(
      "Select a date range to load fixtures. Competition can be All competitions or a specific league.",
    );
  });

  it("requires from + to; competition is optional", () => {
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
