import { describe, expect, it } from "vitest";
import { mergeRefereeDashboard } from "./referee-dashboard-merge";
import type { PublicRefereeProfile } from "./public-referee-profile-service";

const profile = (overrides: Partial<PublicRefereeProfile> = {}): PublicRefereeProfile => ({
  id: "ref-1",
  slug: "andrew-brace-og9nqr9l",
  name: "Andrew Brace",
  countryName: "Ireland",
  nationality: "Irish",
  birthDate: "1988-06-25",
  imageUrl: "https://example.com/brace.jpg",
  bioSummary: "Live bio from the database.",
  wikipediaUrl: null,
  occupation: "Quantity surveyor",
  matchCount: 12,
  internationalMatchCount: 4,
  testMatchCount: 2,
  tournamentCount: 3,
  debutYear: "2017",
  avgRating: 8.64,
  recentMatches: [
    {
      id: "fx-1",
      slug: "leinster-v-munster-2026-03-01",
      kickoffAt: "2026-03-01T15:00:00.000Z",
      status: "full_time",
      competitionName: "URC",
      homeTeamName: "Leinster",
      awayTeamName: "Munster",
      homeScore: 21,
      awayScore: 14,
      homeCrestUrl: "https://example.com/leinster.png",
      awayCrestUrl: "https://example.com/munster.png",
      href: "/matches/abc/urc/urc/leinster-v-munster/2026-03-01",
    },
  ],
  preview: false,
  seo: {
    title: "t",
    description: "d",
    canonicalPath: "/referees/andrew-brace-og9nqr9l",
    noIndex: false,
  },
  ...overrides,
});

describe("mergeRefereeDashboard", () => {
  it("prefers live identity and portrait", () => {
    const model = mergeRefereeDashboard(profile());
    expect(model.name).toBe("Andrew Brace");
    expect(model.portraitUrl).toBe("https://example.com/brace.jpg");
    expect(model.totalMatches).toBe(12);
    expect(model.internationalMatches).toBe(4);
    expect(model.careerStats.find((row) => row.key === "matches")?.value).toBe("12");
    expect(model.careerStats.find((row) => row.key === "internationals")?.value).toBe("4");
    expect(model.bio.profession).toBe("Quantity surveyor");
    expect(model.bio.union).toBe("IRFU");
    expect(model.bio.worldRugbyDebut).toBe("2017");
    expect(model.overallRating).toBe(86.4);
    expect(model.about).toBe("Live bio from the database.");
    expect(model.isMockAnalytics).toBe(true);
  });

  it("maps live appointments into the match table", () => {
    const model = mergeRefereeDashboard(profile());
    expect(model.recentMatches[0]?.fixtureLabel).toContain("Leinster");
    expect(model.recentMatches[0]?.href).toBe("/matches/abc/urc/urc/leinster-v-munster/2026-03-01");
    expect(model.recentMatches[0]?.kickoffAtIso).toBe("2026-03-01T15:00:00.000Z");
    expect(model.recentMatches[0]?.homeCrestUrl).toBe("https://example.com/leinster.png");
    expect(model.recentMatches[0]?.isMock).toBe(true);
  });

  it("does not copy Andrew Brace identity onto another referee", () => {
    const model = mergeRefereeDashboard(
      profile({
        slug: "wayne-barnes-g9nx2wjl",
        name: "Wayne Barnes",
        countryName: null,
        nationality: null,
        birthDate: null,
        imageUrl: "https://example.com/barnes.jpg",
        bioSummary: null,
        occupation: null,
        matchCount: 40,
        internationalMatchCount: 22,
        testMatchCount: 18,
        tournamentCount: 6,
        debutYear: "2006",
        avgRating: 8.03,
        recentMatches: [],
      }),
    );
    expect(model.name).toBe("Wayne Barnes");
    expect(model.countryName).toBe("England");
    expect(model.bio.profession).toBe("—");
    expect(model.bio.union).toBe("RFU");
    expect(model.bio.dateOfBirth).toBe("—");
    expect(model.portraitUrl).toBe("https://example.com/barnes.jpg");
    expect(model.about).toBe("Wayne Barnes is a rugby union referee.");
    expect(model.recentMatches).toEqual([]);
    expect(model.nextAppointment).toBeNull();
    expect(model.totalMatches).toBe(40);
    expect(model.internationalMatches).toBe(22);
  });

  it("leaves the match list empty when none are linked", () => {
    const model = mergeRefereeDashboard(profile({ recentMatches: [], matchCount: 0 }));
    expect(model.recentMatches).toEqual([]);
  });
});
