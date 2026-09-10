import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type SeasonLine = {
  allRugbySeason: string;
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
  starts?: number;
  seasonYear?: number;
};

const here = dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-jantjies-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2016(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2016,
  );
  if (!line) throw new Error(`Missing 2016 TRC line for ${key}`);
  return line;
}

describe("2016 Rugby Championship Jantjies season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2016("elton-jantjies")).toMatchObject({
      appearances: 4,
      starts: 4,
      tries: 0,
      points: 33,
      minutes: 248,
    });
  });

  it("maps All.Rugby 15/16 Rugby Championship rows to calendar 2016", () => {
    const labeled = SEASON_LINES["elton-jantjies"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "15/16",
    );
    expect(labeled.length).toBe(1);
    expect(labeled[0]?.seasonYear).toBe(2016);
  });

  it("does not collide two Rugby Championship lines onto the same calendar year", () => {
    const years = SEASON_LINES["elton-jantjies"]
      ?.filter((row) => row.competitionSlug === "rugby-championship")
      .map((row) => row.seasonYear ?? row.allRugbySeason);
    expect(new Set(years).size).toBe(years?.length);
  });
});

type MatchFile = {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      {
        squadRole: string;
        minutes: number;
        tries: number;
        points: number;
        conversions?: number;
        penalties?: number;
      }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-jantjies-2016-trc-matches.json"), "utf8"),
) as MatchFile;

function matchTotals(key: string) {
  const apps = MATCHES.matches.filter((match) => match.players[key]);
  return {
    appearances: apps.length,
    starts: apps.filter((match) => match.players[key]?.squadRole === "starting").length,
    tries: apps.reduce((sum, match) => sum + (match.players[key]?.tries ?? 0), 0),
    points: apps.reduce((sum, match) => sum + (match.players[key]?.points ?? 0), 0),
    minutes: apps.reduce((sum, match) => sum + (match.players[key]?.minutes ?? 0), 0),
  };
}

describe("2016 Rugby Championship Jantjies match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season line", () => {
    expect(matchTotals("elton-jantjies")).toEqual({
      appearances: 4,
      starts: 4,
      tries: 0,
      points: 33,
      minutes: 248,
    });
  });

  it("omits the last two Tests he did not play", () => {
    const slugs = MATCHES.matches.map((row) => row.fixtureSlug);
    expect(slugs).not.toContain("south-africa-v-australia-2016-10-01");
    expect(slugs).not.toContain("south-africa-v-new-zealand-2016-10-08");
    expect(MATCHES.matches).toHaveLength(4);
  });

  it("records starting fly-half appearances and Nelspruit / Salta scoring", () => {
    const nelspruit = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2016-08-20");
    expect(nelspruit?.players["elton-jantjies"]?.squadRole).toBe("starting");
    expect(nelspruit?.players["elton-jantjies"]?.points).toBe(15);
    expect(nelspruit?.players["elton-jantjies"]?.minutes).toBe(80);

    const salta = MATCHES.matches.find((row) => row.fixtureSlug === "argentina-g567pe6e-v-south-africa-2016-08-27");
    expect(salta?.players["elton-jantjies"]?.minutes).toBe(45);
    expect(salta?.players["elton-jantjies"]?.penalties).toBe(2);
  });
});
