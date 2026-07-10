import { describe, expect, it } from "vitest";
import { parseVenueCapacity, parseVenueRecordAttendance, parseWikipediaArchiveFromHtml } from "./parse-infobox";

describe("parseVenueCapacity", () => {
  it("parses numeric capacity values", () => {
    expect(parseVenueCapacity("82,000")).toBe(82000);
    expect(parseVenueCapacity("75544")).toBe(75544);
  });
});

describe("parseVenueRecordAttendance", () => {
  it("parses record attendance with date suffix", () => {
    expect(parseVenueRecordAttendance("82,000 (vs New Zealand, 2015)")).toBe(82000);
    expect(parseVenueRecordAttendance("75,544")).toBe(75544);
  });
});

describe("parseWikipediaArchiveFromHtml player cup career", () => {
  it("extracts provincial and super rugby rows as cup career", () => {
    const html = `
      <div data-mw='{"parts":[{"template":{"target":{"wt":"Infobox rugby biography"},"params":{
        "name":{"wt":"Test Player"},
        "years1":{"wt":"2020–2022"},
        "clubs1":{"wt":"[[Example RFC]]"},
        "apps1":{"wt":"20"},
        "points1":{"wt":"40"},
        "provinceyears1":{"wt":"2019–2020"},
        "province1":{"wt":"[[Leinster Rugby|Leinster]]"},
        "provinceapps1":{"wt":"5"},
        "provincepoints1":{"wt":"15"},
        "superyears1":{"wt":"2021"},
        "super1":{"wt":"[[Bulls (rugby union)|Bulls]]"},
        "superapps1":{"wt":"3"},
        "superpoints1":{"wt":"9"},
        "repyears1":{"wt":"2020–"},
        "repteam1":{"wt":"[[Ireland national rugby union team|Ireland]]"},
        "repcaps1":{"wt":"10"},
        "reppoints1":{"wt":"20"}
      }}}]}'></div>
    `;

    const parsed = parseWikipediaArchiveFromHtml({
      html,
      articleTitle: "Test Player",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Test_Player",
      entityType: "player",
    });

    expect(parsed.entityType).toBe("player");
    if (parsed.entityType !== "player") return;

    expect(parsed.clubCareer).toHaveLength(1);
    expect(parsed.cupCareer).toHaveLength(2);
    expect(parsed.cupCareer?.every((row) => row.careerType === "cup")).toBe(true);
    expect(parsed.internationalCareer).toHaveLength(1);
  });
});

describe("parseWikipediaArchiveFromHtml coach career", () => {
  it("extracts coaching stints and nationality for coach entity type", () => {
    const html = `
      <div data-mw='{"parts":[{"template":{"target":{"wt":"Infobox rugby biography"},"params":{
        "name":{"wt":"Test Coach"},
        "birth_date":{"wt":"{{birth date and age|df=yes|1979|12|01}}"},
        "birth_place":{"wt":"[[Bath, Somerset|Bath]], England"},
        "coachyears1":{"wt":"2022–"},
        "coachteams1":{"wt":"[[England national rugby union team|England]]"},
        "coachyears2":{"wt":"2012–2022"},
        "coachteams2":{"wt":"[[Leicester Tigers]]"}
      }}}]}'></div>
    `;

    const parsed = parseWikipediaArchiveFromHtml({
      html,
      articleTitle: "Test Coach",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Test_Coach",
      entityType: "coach",
    });

    expect(parsed.entityType).toBe("coach");
    if (parsed.entityType !== "coach") return;

    expect(parsed.nationality).toBe("England");
    expect(parsed.coachingCareer).toHaveLength(2);
    expect(parsed.coachingCareer?.[0].teamName).toContain("England");
  });
});

describe("parseWikipediaArchiveFromHtml referee career", () => {
  it("extracts referee competitions and nationality", () => {
    const html = `
      <div data-mw='{"parts":[{"template":{"target":{"wt":"Infobox rugby biography"},"params":{
        "name":{"wt":"Test Referee"},
        "birth_date":{"wt":"{{birth date and age|df=yes|1979|4|20}}"},
        "birth_place":{"wt":"[[Gloucester]], England"},
        "occupation":{"wt":"Rugby Union referee"},
        "refereeyears1":{"wt":"-"},
        "refereecomps1":{"wt":"[[English Premiership (rugby union)|English Premiership]]"},
        "refereecomps2":{"wt":"[[Six Nations Championship|Six Nations]]"}
      }}}]}'></div>
    `;

    const parsed = parseWikipediaArchiveFromHtml({
      html,
      articleTitle: "Test Referee",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Test_Referee",
      entityType: "referee",
    });

    expect(parsed.entityType).toBe("referee");
    if (parsed.entityType !== "referee") return;

    expect(parsed.nationality).toBe("England");
    expect(parsed.refereeCareer).toHaveLength(2);
    expect(parsed.refereeCareer?.[0].competitionName).toContain("Premiership");
  });
});
