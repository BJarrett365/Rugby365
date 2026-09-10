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
  readFileSync(join(here, "../../../../scripts/springboks-de-villiers-strauss-bismarck-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2013(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2013,
  );
  if (!line) throw new Error(`Missing 2013 TRC line for ${key}`);
  return line;
}

describe("2013 Rugby Championship Springbok season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2013("jean-de-villiers")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 3,
      points: 15,
      minutes: 457,
    });
    expect(trc2013("adriaan-strauss")).toMatchObject({
      appearances: 6,
      starts: 3,
      tries: 2,
      points: 10,
      minutes: 251,
    });
    expect(trc2013("bismarck-du-plessis")).toMatchObject({
      appearances: 6,
      starts: 3,
      tries: 2,
      points: 10,
      minutes: 223,
    });
  });

  it("does not invent 2013 Super Rugby or unused-squad appearances", () => {
    for (const key of ["jean-de-villiers", "adriaan-strauss", "bismarck-du-plessis"]) {
      const super2013 = SEASON_LINES[key]?.filter(
        (row) => row.competitionSlug === "super-rugby" && (row.seasonYear === 2013 || row.allRugbySeason === "2013"),
      );
      expect(super2013).toEqual([]);
    }
  });

  it("maps All.Rugby 13/14 Rugby Championship rows to calendar 2014, not 2013", () => {
    for (const key of ["jean-de-villiers", "adriaan-strauss", "bismarck-du-plessis"]) {
      const labeled = SEASON_LINES[key]?.filter(
        (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "13/14",
      );
      expect(labeled.length).toBe(1);
      expect(labeled[0]?.seasonYear).toBe(2014);
    }
  });
});

type MatchFile = {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      { squadRole: string; minutes: number; tries: number; points: number }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(
    join(here, "../../../../scripts/springboks-de-villiers-strauss-bismarck-2013-trc-matches.json"),
    "utf8",
  ),
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

describe("2013 Rugby Championship Springbok match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season lines", () => {
    expect(matchTotals("jean-de-villiers")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 3,
      points: 15,
      minutes: 457,
    });
    expect(matchTotals("adriaan-strauss")).toEqual({
      appearances: 6,
      starts: 3,
      tries: 2,
      points: 10,
      minutes: 251,
    });
    expect(matchTotals("bismarck-du-plessis")).toEqual({
      appearances: 6,
      starts: 3,
      tries: 2,
      points: 10,
      minutes: 223,
    });
  });

  it("records actual involvement including bench appearances", () => {
    const johannesburg = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2013-08-17");
    expect(johannesburg?.players["adriaan-strauss"]?.squadRole).toBe("starting");
    expect(johannesburg?.players["bismarck-du-plessis"]?.squadRole).toBe("bench");
    expect(johannesburg?.players["bismarck-du-plessis"]?.tries).toBe(1);

    const auckland = MATCHES.matches.find((row) => row.fixtureSlug.includes("2013-09-14"));
    expect(auckland?.players["bismarck-du-plessis"]?.squadRole).toBe("starting");
    expect(auckland?.players["bismarck-du-plessis"]?.tries).toBe(1);
    expect(auckland?.players["adriaan-strauss"]?.squadRole).toBe("bench");
    expect(auckland?.players["jean-de-villiers"]?.squadRole).toBe("starting");
  });

  it("does not omit any of the six 2013 Tests for these three players", () => {
    expect(MATCHES.matches).toHaveLength(6);
    for (const match of MATCHES.matches) {
      expect(match.players["jean-de-villiers"]).toBeDefined();
      expect(match.players["adriaan-strauss"]).toBeDefined();
      expect(match.players["bismarck-du-plessis"]).toBeDefined();
    }
  });
});
