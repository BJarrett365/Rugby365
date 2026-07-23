import { describe, expect, it } from "vitest";
import {
  groupMatchesByCompetitionSeason,
  inferMatchProvider,
  localDateKey,
  matchCmsFiltersToSearchParams,
  matchProviderLabel,
  parseMatchCmsFilters,
  shiftDateKey,
  type MatchCmsListRow,
} from "./match-cms-list-utils";

describe("inferMatchProvider", () => {
  it("prefers confirmed rugby_data mapping", () => {
    expect(
      inferMatchProvider({
        rugbyDataExternalId: "5370",
        sport365Url: "https://example/sport365",
        planetRugbyUrl: "https://example/pr",
      }),
    ).toBe("rugby_data");
  });

  it("prefers explicit primarySource over inference", () => {
    expect(
      inferMatchProvider({
        primarySource: "manual",
        rugbyDataExternalId: "5370",
        sport365Url: "https://example/sport365",
      }),
    ).toBe("manual");
  });

  it("detects livesport and wikipedia prefixes", () => {
    expect(inferMatchProvider({ externalMatchId: "livesport:123" })).toBe("livesport");
    expect(inferMatchProvider({ externalMatchId: "wikipedia:abc" })).toBe("wikipedia");
  });

  it("prefers sport365 url over bare external id", () => {
    expect(
      inferMatchProvider({
        externalMatchId: "1-99",
        sport365Url: "https://sport365.example/1-99",
      }),
    ).toBe("sport365");
  });

  it("falls back to planet_rugby then manual", () => {
    expect(inferMatchProvider({ externalMatchId: "0628myn6" })).toBe("planet_rugby");
    expect(inferMatchProvider({})).toBe("manual");
  });
});

describe("parseMatchCmsFilters / URL round-trip", () => {
  it("parses defaults and round-trips non-default params", () => {
    const parsed = parseMatchCmsFilters(
      new URLSearchParams(
        "from=2026-07-10&to=2026-07-10&competitionId=abc&q=Bath&sort=home&sortDir=asc&page=2",
      ),
    );
    expect(parsed.fromDate).toBe("2026-07-10");
    expect(parsed.teamQuery).toBe("Bath");
    expect(parsed.sort).toBe("home");
    expect(parsed.page).toBe(2);

    const sp = matchCmsFiltersToSearchParams(parsed);
    expect(sp.get("from")).toBe("2026-07-10");
    expect(sp.get("q")).toBe("Bath");
    expect(sp.get("sort")).toBe("home");
    expect(sp.get("page")).toBe("2");
  });
});

describe("groupMatchesByCompetitionSeason", () => {
  it("groups and marks mixed providers", () => {
    const rows: MatchCmsListRow[] = [
      {
        id: "1",
        slug: "a-v-b",
        kickoffAt: null,
        status: "scheduled",
        homeScore: 0,
        awayScore: 0,
        externalMatchId: null,
        primaryApiMatchId: null,
        provider: "planet_rugby",
        competitionId: "c1",
        competitionName: "Prem",
        seasonId: "s1",
        seasonLabel: "2025–26",
        homeTeamId: null,
        homeTeamName: "Bath",
        awayTeamId: null,
        awayTeamName: "Leicester",
        venueId: null,
        refereeId: null,
        hasLineups: false,
        hasTeamStats: false,
        hasPlayerStats: false,
        scoreLocked: false,
        statusLocked: false,
        warningCount: 0,
      },
      {
        id: "2",
        slug: "c-v-d",
        kickoffAt: null,
        status: "full_time",
        homeScore: 20,
        awayScore: 10,
        externalMatchId: null,
        primaryApiMatchId: null,
        provider: "sport365",
        competitionId: "c1",
        competitionName: "Prem",
        seasonId: "s1",
        seasonLabel: "2025–26",
        homeTeamId: null,
        homeTeamName: "Sale",
        awayTeamId: null,
        awayTeamName: "Exeter",
        venueId: null,
        refereeId: null,
        hasLineups: false,
        hasTeamStats: false,
        hasPlayerStats: false,
        scoreLocked: false,
        statusLocked: false,
        warningCount: 0,
      },
    ];
    const groups = groupMatchesByCompetitionSeason(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.matchCount).toBe(2);
    expect(groups[0]!.mainProvider).toBe("mixed");
  });
});

describe("date helpers", () => {
  it("shifts date keys", () => {
    expect(shiftDateKey("2026-07-10", 1)).toBe("2026-07-11");
    expect(shiftDateKey("2026-07-10", -1)).toBe("2026-07-09");
    expect(localDateKey(new Date("2026-07-10T12:00:00"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("matchProviderLabel", () => {
  it("labels rugby_data as Sport CC Data", () => {
    expect(matchProviderLabel("rugby_data")).toBe("Sport CC Data");
    expect(matchProviderLabel("planet_rugby")).toBe("Planet Rugby");
  });
});
