import { describe, expect, it } from "vitest";
import {
  isProvisional,
  pickDefaultRankingSeason,
  rankingSeasonQueryValue,
  previousRankByPriorAverage,
  rankingPositionGroup,
  rating10To100,
  refereeDifficultyAdjustment,
  tournamentRatingFromMatches,
  computeRefereeFormScore,
  padRefereeFormSeries,
  isRankingRetired,
  mergeRefereeClubs,
  collectRefereeAppointmentClubs,
  foldRefereeIdentity,
  isUnknownRankingOfficial,
  cleanRankingRefereeName,
  isGarbageRefereeClubName,
  sanitizeRefereeClubSet,
  refereeNationalityFallback,
  refereeClubFallback,
  preferClubWithCrest,
} from "./competition-ranking-math";

describe("rating10To100", () => {
  it("scales match ratings", () => {
    expect(rating10To100(7.5)).toBe(75);
    expect(rating10To100(null)).toBeNull();
  });
});

describe("refereeDifficultyAdjustment", () => {
  it("adds final bonus only when rating is strong", () => {
    expect(refereeDifficultyAdjustment({ rating100: 80, round: "Final" })).toBe(4);
    expect(refereeDifficultyAdjustment({ rating100: 70, round: "Final" })).toBe(0);
  });

  it("adds close-match bump", () => {
    expect(
      refereeDifficultyAdjustment({ rating100: 78, round: "Round 3", margin: 3 }),
    ).toBe(1);
  });
});

describe("tournamentRatingFromMatches", () => {
  it("averages ratings with difficulty", () => {
    expect(tournamentRatingFromMatches([80, 70], [2, 0])).toBe(76);
  });
});

describe("rankingPositionGroup", () => {
  it("maps common labels", () => {
    expect(rankingPositionGroup("Openside Flanker")).toBe("back_row");
    expect(rankingPositionGroup("Fly Half")).toBe("fly_halves");
  });
});

describe("isProvisional", () => {
  it("requires two matches by default", () => {
    expect(isProvisional(1)).toBe(true);
    expect(isProvisional(2)).toBe(false);
  });
});

describe("pickDefaultRankingSeason", () => {
  it("skips a future active season with no results", () => {
    const seasons = [
      { id: "2027", year: 2027, isActive: true },
      { id: "2023", year: 2023, isActive: false },
      { id: "2019", year: 2019, isActive: false },
    ];
    expect(pickDefaultRankingSeason(seasons, new Set(["2023", "2019"]))?.id).toBe("2023");
  });
});

describe("rankingSeasonQueryValue", () => {
  it("writes the World Cup calendar year even when the label is a range", () => {
    expect(
      rankingSeasonQueryValue("rugby-world-cup", { year: 2023, label: "2023–24" }),
    ).toBe("2023");
  });

  it("keeps club season labels as-is", () => {
    expect(
      rankingSeasonQueryValue("premiership", { year: 2024, label: "2024–25" }),
    ).toBe("2024–25");
  });
});

describe("computeRefereeFormScore", () => {
  it("rates a close World Cup final in the high 80s–90s", () => {
    const score = computeRefereeFormScore({
      rating100: 78,
      homeScore: 27,
      awayScore: 24,
      yellowCards: 3,
      redCards: 0,
      penaltyEvents: 14,
      round: "Final",
    });
    expect(score).toBeGreaterThanOrEqual(86);
    expect(score).toBeLessThanOrEqual(96);
  });

  it("pads last-five form with a gentle decline", () => {
    expect(padRefereeFormSeries([92, 88])).toEqual([92, 88, 84, 81, 78]);
  });
});

describe("countryFromWikipediaExtract", () => {
  it("reads nationality from a Wikipedia lead", async () => {
    const { countryFromWikipediaExtract } = await import("./wikipedia-page-image");
    expect(
      countryFromWikipediaExtract(
        "Wayne Barnes (born 20 April 1979) is an English former international rugby union referee.",
      ),
    ).toBe("England");
  });
});

describe("isRankingRetired", () => {
  it("flags stored retired status, not editorial legends who still play", () => {
    expect(isRankingRetired({ careerStatus: "retired", name: "John Smit" })).toBe(true);
    expect(isRankingRetired({ careerStatus: "legend", name: "Siya Kolisi" })).toBe(false);
    expect(isRankingRetired({ careerStatus: "active", name: "Antoine Dupont" })).toBe(false);
    expect(isRankingRetired({ careerStatus: "active", name: "John Smit retired" })).toBe(true);
    expect(isRankingRetired({ name: "Wayne Barnes" })).toBe(true);
    expect(isRankingRetired({ name: "Andrew Brace" })).toBe(false);
    expect(isRankingRetired({ careerStatus: "active", name: "John Kirwan" })).toBe(false);
    expect(isRankingRetired({ careerStatus: "retired", name: "John Kirwan" })).toBe(true);
    expect(isRankingRetired({ careerStatus: "deceased", name: "Jonah Lomu" })).toBe(true);
  });
});

describe("mergeRefereeClubs", () => {
  it("keeps last club first and de-dupes the rest", () => {
    expect(
      mergeRefereeClubs(
        { lastClub: "RFU", clubs: ["RFU"] },
        { lastClub: "Old Patesians", clubs: ["Old Patesians", "Gloucestershire RFU"] },
      ),
    ).toEqual({
      lastClub: "Old Patesians",
      clubs: ["Old Patesians", "RFU", "Gloucestershire RFU"],
    });
  });

  it("lets appointment clubs overwrite a union fallback as last club", () => {
    expect(
      mergeRefereeClubs(
        { lastClub: "RFU", clubs: ["RFU"] },
        { lastClub: "Sharks", clubs: ["Sharks", "Leicester Tigers", "Harlequins"] },
      ),
    ).toEqual({
      lastClub: "Sharks",
      clubs: ["Sharks", "RFU", "Leicester Tigers", "Harlequins"],
    });
  });
});

describe("collectRefereeAppointmentClubs", () => {
  it("uses the most recent club as last and de-dupes by slug", () => {
    const set = collectRefereeAppointmentClubs([
      { name: "Leicester Tigers", slug: "leicester-tigers", lastSeen: "2026-05-09" },
      { name: "Sharks", slug: "coastal-sharks", lastSeen: "2026-08-11T17:00:00Z" },
      { name: "Leicester Tigers", slug: "leicester-tigers", lastSeen: "2024-01-01" },
      { name: "Harlequins", slug: "harlequins", lastSeen: "2026-05-16" },
    ]);
    expect(set.lastClub).toBe("Sharks");
    expect(set.clubs).toEqual(["Sharks", "Harlequins", "Leicester Tigers"]);
  });

  it("collapses hyphen/accent variants and keeps a live slug", () => {
    const set = collectRefereeAppointmentClubs([
      { name: "Bordeaux-Bègles", slug: null, lastSeen: "2017-01-21" },
      { name: "Bordeaux Begles", slug: "bordeaux-begles-do6l3o6y", lastSeen: "2016-01-01" },
    ]);
    expect(set.clubs).toEqual(["Bordeaux-Bègles"]);
    expect(set.hits[0]?.slug).toBe("bordeaux-begles-do6l3o6y");
  });
});

describe("foldRefereeIdentity", () => {
  it("treats duplicate Matthew Carley rows as one referee", () => {
    expect(foldRefereeIdentity("Matthew Carley (RFU)")).toBe("matthew carley");
    expect(foldRefereeIdentity("Matthew Carley (England)")).toBe("matthew carley");
    expect(foldRefereeIdentity("Matt Carley")).toBe("matthew carley");
  });

  it("strips union suffixes from appointed-official names", () => {
    expect(cleanRankingRefereeName("Joël Dume (France)")).toBe("Joël Dume");
    expect(cleanRankingRefereeName("Matthew Carley (RFU)")).toBe("Matthew Carley");
  });
});

describe("isUnknownRankingOfficial", () => {
  it("drops placeholder referee rows", () => {
    expect(isUnknownRankingOfficial("Referee Unknown")).toBe(true);
    expect(isUnknownRankingOfficial("Wayne Barnes")).toBe(false);
  });
});

describe("referee archive identity", () => {
  it("maps historical World Cup officials to the correct nation and club", () => {
    expect(refereeNationalityFallback("Stephen Hilditch")).toBe("Ireland");
    expect(refereeNationalityFallback("Joël Dume (France)")).toBe("France");
    expect(refereeNationalityFallback("Jonathan Kaplan")).toBe("South Africa");
    expect(refereeNationalityFallback("Luke Pearce")).toBe("England");
    expect(refereeClubFallback("Andrew Brace")?.lastClub).toBe("Sundays Well");
    expect(refereeClubFallback("Wayne Barnes")?.lastClub).toBe("Old Patesians");
    expect(refereeClubFallback("Kerry Fitzgerald")?.lastClub).toBe("Rugby Australia");
    expect(refereeNationalityFallback("Barry Leask")).toBe("Australia");
  });

  it("drops footballer Wikipedia leftovers from referee clubs", () => {
    expect(isGarbageRefereeClubName("Arsenal |caps1 = 1 |goals1 = 0")).toBe(true);
    expect(isGarbageRefereeClubName("Manchester United")).toBe(true);
    expect(isGarbageRefereeClubName("Sundays Well")).toBe(false);
    expect(
      sanitizeRefereeClubSet({
        lastClub: "| youthyears1 = 1988–1989 |youthclubs1 = Arsenal",
        clubs: ["Arsenal |caps1 = 1 |goals1 = 0", "Sundays Well"],
      }),
    ).toEqual({ lastClub: "Sundays Well", clubs: ["Sundays Well"] });
  });
});

describe("preferClubWithCrest", () => {
  it("promotes a badged club when last club has no crest", () => {
    expect(
      preferClubWithCrest(
        { lastClub: "Old Patesians", clubs: ["Old Patesians", "Gloucestershire RFU", "RFU"] },
        (name) => name === "RFU",
      ),
    ).toEqual({ lastClub: "RFU", clubs: ["RFU", "Old Patesians", "Gloucestershire RFU"] });
  });
});

describe("parseRefereeClubsFromWikitext", () => {
  it("reads union and amateur clubs from an infobox", async () => {
    const { parseRefereeClubsFromWikitext } = await import("./wikipedia-page-image");
    expect(
      parseRefereeClubsFromWikitext(`{{Infobox rugby biography
| union = [[Gloucestershire Rugby Football Union|Gloucestershire RFU]]
| ru_amateurclubs1 = [[Old Patesians RFC|Old Patesians]]
}}

== Career ==
`),
    ).toEqual({
      lastClub: "Old Patesians",
      clubs: ["Old Patesians", "Gloucestershire RFU"],
    });
  });

  it("rejects association-football infoboxes", async () => {
    const { parseRefereeClubsFromWikitext, isRugbyRefereeExtract, wikipediaTitleCandidates } =
      await import("./wikipedia-page-image");
    expect(
      parseRefereeClubsFromWikitext(`{{Infobox football biography
| clubs1 = [[Arsenal F.C.|Arsenal]]
| caps1 = 1
| goals1 = 0
| clubs2 = [[Manchester United F.C.|Manchester United]]
}}`),
    ).toEqual({ lastClub: null, clubs: [] });
    expect(
      isRugbyRefereeExtract(
        "Andrew Cole is an English former professional footballer who played as a striker.",
      ),
    ).toBe(false);
    expect(
      isRugbyRefereeExtract(
        "Wayne Barnes (born 20 April 1979) is an English former international rugby union referee.",
      ),
    ).toBe(true);
    expect(wikipediaTitleCandidates("Owen Doyle", "referee")[0]).toBe("Owen Doyle (rugby union)");
    expect(wikipediaTitleCandidates("Tomas Francis", "player")[0]).toBe("Tomas Francis");
    expect(wikipediaTitleCandidates("Jonathan Davies", "player")[0]).toBe("Jonathan Davies (rugby union)");
  });
});

describe("previousRankByPriorAverage", () => {
  it("ranks by the average of all but the newest rating", () => {
    const map = previousRankByPriorAverage([
      { playerId: "a", ratings: [90, 80] },
      { playerId: "b", ratings: [85, 90] },
      { playerId: "c", ratings: [99] },
    ]);
    expect(map.get("b")).toBe(1);
    expect(map.get("a")).toBe(2);
    expect(map.has("c")).toBe(false);
  });
});
