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
  readFileSync(join(here, "../../../../scripts/springboks-hendrikse-kitshoff-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2022(key: string) {
  return SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2022,
  );
}

describe("2022 Rugby Championship Hendrikse / Kitshoff season lines", () => {
  it("records Kitshoff's six verified appearances and omits Jordan who did not play", () => {
    expect(trc2022("steven-kitshoff")).toMatchObject({
      appearances: 6,
      starts: 3,
      tries: 0,
      points: 0,
      minutes: 320,
    });
    expect(trc2022("jordan-hendrikse")).toBeUndefined();
  });

  it("maps All.Rugby 21/22 Rugby Championship rows to calendar 2022", () => {
    const kitshoff = SEASON_LINES["steven-kitshoff"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "21/22",
    );
    expect(kitshoff).toHaveLength(1);
    expect(kitshoff[0]?.seasonYear).toBe(2022);
  });

  it("does not invent a 2022 Rugby Championship line for Jordan Hendrikse", () => {
    const trc = SEASON_LINES["jordan-hendrikse"]?.filter((row) => row.competitionSlug === "rugby-championship");
    expect(trc).toEqual([]);
  });

  it("omits unused replacements from club appearance totals", () => {
    const urc2223 = SEASON_LINES["jordan-hendrikse"]?.find(
      (row) => row.competitionSlug === "united-rugby-championship" && row.allRugbySeason === "22/23",
    );
    const urc2324 = SEASON_LINES["jordan-hendrikse"]?.find(
      (row) => row.competitionSlug === "united-rugby-championship" && row.allRugbySeason === "23/24",
    );
    expect(urc2223).toMatchObject({ appearances: 11, starts: 8, minutes: 564 });
    expect(urc2324).toMatchObject({ appearances: 17, starts: 9, minutes: 833 });
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
  readFileSync(join(here, "../../../../scripts/springboks-hendrikse-kitshoff-2022-trc-matches.json"), "utf8"),
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

describe("2022 Rugby Championship Hendrikse / Kitshoff match sheets", () => {
  it("match-by-match minutes sum to Kitshoff's verified season line", () => {
    expect(matchTotals("steven-kitshoff")).toEqual({
      appearances: 6,
      starts: 3,
      tries: 0,
      points: 0,
      minutes: 320,
    });
  });

  it("omits Jordan Hendrikse from every 2022 Championship match", () => {
    expect(matchTotals("jordan-hendrikse")).toEqual({
      appearances: 0,
      starts: 0,
      tries: 0,
      points: 0,
      minutes: 0,
    });
    for (const match of MATCHES.matches) {
      expect(match.players["jordan-hendrikse"]).toBeUndefined();
    }
  });

  it("includes all six Tests Kitshoff played", () => {
    expect(MATCHES.matches.map((row) => row.fixtureSlug)).toEqual([
      "south-africa-v-all-blacks-2022-08-06",
      "south-africa-v-all-blacks-2022-08-13",
      "australia-og9nxrjl-v-south-africa-2022-08-27",
      "australia-og9nxrjl-v-south-africa-2022-09-03",
      "argentina-g567pe6e-v-south-africa-2022-09-17",
      "south-africa-v-argentina-2022-09-24",
    ]);
    expect(MATCHES.matches).toHaveLength(6);
  });

  it("records three bench appearances then three starts at loose-head", () => {
    const nelspruit = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-all-blacks-2022-08-06");
    expect(nelspruit?.players["steven-kitshoff"]).toMatchObject({
      squadRole: "bench",
      jerseyNumber: 17,
      minutes: 41,
    });

    const sydney = MATCHES.matches.find(
      (row) => row.fixtureSlug === "australia-og9nxrjl-v-south-africa-2022-09-03",
    );
    expect(sydney?.players["steven-kitshoff"]).toMatchObject({
      squadRole: "starting",
      jerseyNumber: 1,
      minutes: 71,
    });

    const durban = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2022-09-24");
    expect(durban?.players["steven-kitshoff"]).toMatchObject({
      squadRole: "starting",
      jerseyNumber: 1,
      minutes: 57,
    });
  });
});
