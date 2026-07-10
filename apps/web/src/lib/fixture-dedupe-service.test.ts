import { describe, expect, it } from "vitest";
import {
  pickCanonicalFixture,
  scoreFixtureForCanonical,
  type FixtureDedupeRow,
} from "./fixture-dedupe-service";

const base = (overrides: Partial<FixtureDedupeRow>): FixtureDedupeRow => ({
  id: "a",
  slug: "south-africa-v-barbarians",
  homeTeamId: "h",
  awayTeamId: "a",
  kickoffAt: new Date("2026-06-20T13:00:00.000Z"),
  competitionId: null,
  seasonId: null,
  competitionName: "International",
  status: "full_time",
  homeScore: 80,
  awayScore: 31,
  sport365Url: null,
  planetRugbyUrl: null,
  externalMatchId: null,
  venueId: null,
  venueName: null,
  attendance: null,
  refereeId: null,
  refereeName: null,
  homeCoachId: null,
  awayCoachId: null,
  round: null,
  providerSnapshot: null,
  rugby365PotmPlayerId: null,
  officialPotmPlayerId: null,
  officialPotmName: null,
  ...overrides,
});

describe("fixture dedupe scoring", () => {
  it("prefers Planet Rugby + SDMS id over Sport365-only rows", () => {
    const sport365 = base({
      id: "sport365",
      sport365Url: "https://www.sport365.com/example/1-4307586",
      externalMatchId: "1-4307586",
      competitionId: "comp-1",
    });
    const planet = base({
      id: "planet",
      slug: "south-africa-v-barbarians-2026-06-20",
      planetRugbyUrl: "https://www.planetrugby.com/matches/567px4m6/example",
      externalMatchId: "567px4m6",
    });
    expect(scoreFixtureForCanonical(planet)).toBeGreaterThan(scoreFixtureForCanonical(sport365));
    expect(pickCanonicalFixture([sport365, planet]).id).toBe("planet");
  });

  it("penalizes livesport and wikipedia import keys", () => {
    const livesport = base({ id: "live", externalMatchId: "livesport:abc123" });
    const wiki = base({ id: "wiki", externalMatchId: "wikipedia:season:2020-08-15:home-v-away:regular" });
    const clean = base({ id: "clean", slug: "home-v-away-2020-08-15", externalMatchId: "abc123" });
    expect(scoreFixtureForCanonical(clean)).toBeGreaterThan(scoreFixtureForCanonical(livesport));
    expect(scoreFixtureForCanonical(clean)).toBeGreaterThan(scoreFixtureForCanonical(wiki));
  });
});
