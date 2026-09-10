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
  readFileSync(join(here, "../../../../scripts/springboks-skosan-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2017(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2017,
  );
  if (!line) throw new Error(`Missing 2017 TRC line for ${key}`);
  return line;
}

describe("2017 Rugby Championship Skosan season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2017("courtnall-skosan")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 480,
    });
  });

  it("maps All.Rugby 16/17 Rugby Championship rows to calendar 2017", () => {
    const labeled = SEASON_LINES["courtnall-skosan"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "16/17",
    );
    expect(labeled.length).toBe(1);
    expect(labeled[0]?.seasonYear).toBe(2017);
  });

  it("does not collide two Rugby Championship lines onto the same calendar year", () => {
    const years = SEASON_LINES["courtnall-skosan"]
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
        jerseyNumber?: number;
      }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-skosan-2017-trc-matches.json"), "utf8"),
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

describe("2017 Rugby Championship Skosan match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season line", () => {
    expect(matchTotals("courtnall-skosan")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 480,
    });
  });

  it("includes all six Tests he started", () => {
    const slugs = MATCHES.matches.map((row) => row.fixtureSlug);
    expect(slugs).toEqual([
      "south-africa-v-argentina-2017-08-19",
      "argentina-g567pe6e-v-south-africa-2017-08-26",
      "australia-og9nxrjl-v-south-africa-2017-09-09",
      "new-zealand-5d9ywpjo-v-south-africa-2017-09-16",
      "south-africa-v-australia-2017-09-30",
      "south-africa-v-new-zealand-2017-10-07",
    ]);
    expect(MATCHES.matches).toHaveLength(6);
  });

  it("records starting left-wing appearances and Port Elizabeth / Bloemfontein tries", () => {
    const pe = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2017-08-19");
    expect(pe?.players["courtnall-skosan"]?.squadRole).toBe("starting");
    expect(pe?.players["courtnall-skosan"]?.jerseyNumber).toBe(11);
    expect(pe?.players["courtnall-skosan"]?.tries).toBe(1);
    expect(pe?.players["courtnall-skosan"]?.points).toBe(5);
    expect(pe?.players["courtnall-skosan"]?.minutes).toBe(80);

    const bloem = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-australia-2017-09-30");
    expect(bloem?.players["courtnall-skosan"]?.squadRole).toBe("starting");
    expect(bloem?.players["courtnall-skosan"]?.tries).toBe(1);
    expect(bloem?.players["courtnall-skosan"]?.points).toBe(5);
    expect(bloem?.players["courtnall-skosan"]?.minutes).toBe(80);
  });
});
