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
  readFileSync(join(here, "../../../../scripts/springboks-dyantyi-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2018(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2018,
  );
  if (!line) throw new Error(`Missing 2018 TRC line for ${key}`);
  return line;
}

describe("2018 Rugby Championship Dyantyi season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2018("aphiwe-dyantyi")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 5,
      points: 25,
      minutes: 464,
    });
  });

  it("maps All.Rugby 17/18 Rugby Championship rows to calendar 2018", () => {
    const labeled = SEASON_LINES["aphiwe-dyantyi"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "17/18",
    );
    expect(labeled.length).toBe(1);
    expect(labeled[0]?.seasonYear).toBe(2018);
  });

  it("does not collide two Rugby Championship lines onto the same calendar year", () => {
    const years = SEASON_LINES["aphiwe-dyantyi"]
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
  readFileSync(join(here, "../../../../scripts/springboks-dyantyi-2018-trc-matches.json"), "utf8"),
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

describe("2018 Rugby Championship Dyantyi match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season line", () => {
    expect(matchTotals("aphiwe-dyantyi")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 5,
      points: 25,
      minutes: 464,
    });
  });

  it("includes all six Tests he started", () => {
    const slugs = MATCHES.matches.map((row) => row.fixtureSlug);
    expect(slugs).toEqual([
      "south-africa-v-argentina-2018-08-18",
      "argentina-g567pe6e-v-south-africa-2018-08-25",
      "australia-og9nxrjl-v-south-africa-2018-09-08",
      "new-zealand-5d9ywpjo-v-south-africa-2018-09-15",
      "south-africa-v-australia-2018-09-29",
      "south-africa-v-new-zealand-2018-10-06",
    ]);
    expect(MATCHES.matches).toHaveLength(6);
  });

  it("records starting left-wing appearances and Durban / Wellington / Port Elizabeth tries", () => {
    const durban = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2018-08-18");
    expect(durban?.players["aphiwe-dyantyi"]?.squadRole).toBe("starting");
    expect(durban?.players["aphiwe-dyantyi"]?.jerseyNumber).toBe(11);
    expect(durban?.players["aphiwe-dyantyi"]?.tries).toBe(2);
    expect(durban?.players["aphiwe-dyantyi"]?.points).toBe(10);

    const wellington = MATCHES.matches.find(
      (row) => row.fixtureSlug === "new-zealand-5d9ywpjo-v-south-africa-2018-09-15",
    );
    expect(wellington?.players["aphiwe-dyantyi"]?.tries).toBe(2);
    expect(wellington?.players["aphiwe-dyantyi"]?.points).toBe(10);
    expect(wellington?.players["aphiwe-dyantyi"]?.minutes).toBe(80);

    const pe = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-australia-2018-09-29");
    expect(pe?.players["aphiwe-dyantyi"]?.squadRole).toBe("starting");
    expect(pe?.players["aphiwe-dyantyi"]?.tries).toBe(1);
    expect(pe?.players["aphiwe-dyantyi"]?.points).toBe(5);
    expect(pe?.players["aphiwe-dyantyi"]?.minutes).toBe(70);
  });
});
